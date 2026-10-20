// lib/anti-bypass.ts
import crypto from "crypto";
import type { CheckpointItem } from "./store";

const HMAC_SECRET =
  process.env.ANTI_BYPASS_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "atomprotect_fortress_stateless_secret_v2_981274";

// In-memory set of consumed claim tokens to prevent replay attacks
const consumedClaimTokens = new Set<string>();

export function isIpMatching(tokenIp: string, reqIp: string): boolean {
  if (!tokenIp || !reqIp) return true;
  if (tokenIp === reqIp) return true;

  // Localhost aliases
  const isLocalToken =
    tokenIp === "127.0.0.1" || tokenIp === "::1" || tokenIp === "localhost";
  const isLocalReq =
    reqIp === "127.0.0.1" || reqIp === "::1" || reqIp === "localhost";
  if (isLocalToken && isLocalReq) return true;

  // Allow dual-stack transitions (e.g. mobile carrier switching between IPv4 NAT64 and IPv6)
  const tokenIsV6 = tokenIp.includes(":");
  const reqIsV6 = reqIp.includes(":");
  if (tokenIsV6 !== reqIsV6) {
    return true;
  }

  return false;
}

export function createSignedToken<T extends object>(payload: T): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", HMAC_SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifySignedToken<T extends object>(
  token: string
): { valid: boolean; payload?: T; error?: string } {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, error: "Malformed token format." };
  }

  const [b64, sig] = token.split(".");
  if (!b64 || !sig) {
    return { valid: false, error: "Invalid token structure." };
  }

  const expectedSig = crypto.createHmac("sha256", HMAC_SECRET).update(b64).digest("base64url");
  if (sig.length !== expectedSig.length) {
    return { valid: false, error: "Invalid token signature length." };
  }

  const match = crypto.timingSafeEqual(
    Buffer.from(sig, "utf8"),
    Buffer.from(expectedSig, "utf8")
  );
  if (!match) {
    return { valid: false, error: "Token signature verification failed. Tampering detected." };
  }

  try {
    const raw = Buffer.from(b64, "base64url").toString("utf8");
    const payload = JSON.parse(raw) as T & { exp?: number };
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, error: "Token has expired. Please refresh the page." };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Failed to parse token payload." };
  }
}

export function generatePoWChallenge(difficulty = 3): { nonce: string; difficulty: number } {
  return {
    nonce: crypto.randomBytes(16).toString("hex"),
    difficulty,
  };
}

export function verifyPoWSolution(nonce: string, solution: string, difficulty: number): boolean {
  if (!solution || typeof solution !== "string") return false;
  const hash = crypto.createHash("sha256").update(nonce + solution).digest("hex");
  const prefix = "0".repeat(difficulty);
  return hash.startsWith(prefix);
}

export interface GatewayTokenPayload {
  t: "gw";
  sid: string;
  step: number;
  total: number;
  ip: string;
  targetUrl: string;
  duration: number;
  scriptId: string;
  exp: number;
}

export interface ActiveStepTokenPayload {
  t: "active";
  sid: string;
  step: number;
  total: number;
  ip: string;
  startedAt: number; // Server clock millisecond timestamp
  duration: number;
  scriptId: string;
  powNonce: string;
  powDifficulty: number;
  exp: number;
}

export interface ClaimTokenPayload {
  t: "claim";
  sid: string;
  scriptId: string;
  ip: string;
  completedAt: number;
  exp: number;
}

export const antiBypassService = {
  createSession(
    ip: string,
    userAgent: string,
    scriptId: string,
    checkpoints: CheckpointItem[]
  ): {
    sessionId: string;
    totalSteps: number;
    currentStep: number;
    stepDetails: {
      id: string;
      title: string;
      duration_seconds: number;
      order: number;
      gatewayUrl: string;
      gatewayToken: string;
    }[];
    powChallenge: { nonce: string; difficulty: number };
  } {
    const sessionId = crypto.randomUUID();
    const sorted = [...checkpoints].sort((a, b) => a.order - b.order);
    const totalSteps = sorted.length;
    const powChallenge = generatePoWChallenge(3);

    const stepDetails = sorted.map((cp, idx) => {
      const duration = Math.max(5, Number(cp.duration_seconds) || 5);
      const gwPayload: GatewayTokenPayload = {
        t: "gw",
        sid: sessionId,
        step: idx,
        total: totalSteps,
        ip,
        targetUrl: cp.url,
        duration,
        scriptId,
        exp: Date.now() + 60 * 60 * 1000, // 1 hour validity
      };
      const gatewayToken = createSignedToken(gwPayload);
      const gatewayUrl = `/api/checkpoints/gateway?gt=${gatewayToken}`;

      return {
        id: cp.id,
        title: cp.title,
        duration_seconds: duration,
        order: cp.order,
        gatewayUrl,
        gatewayToken,
      };
    });

    return {
      sessionId,
      totalSteps,
      currentStep: 0,
      stepDetails,
      powChallenge,
    };
  },

  resolveGateway(
    gatewayToken: string,
    ip?: string
  ): {
    success: boolean;
    targetUrl?: string;
    error?: string;
  } {
    const res = verifySignedToken<GatewayTokenPayload>(gatewayToken);
    if (!res.valid || !res.payload) {
      return { success: false, error: res.error || "Invalid task gateway token." };
    }

    const payload = res.payload;
    if (payload.t !== "gw" || !payload.targetUrl) {
      return { success: false, error: "Invalid gateway payload or destination URL missing." };
    }

    if (ip && !isIpMatching(payload.ip, ip)) {
      // Allow redirect even if IP changed, destination task is external
    }

    return {
      success: true,
      targetUrl: payload.targetUrl,
    };
  },

  // Backwards compatibility for older link formats
  registerGatewayVisit(
    session: string,
    step: number,
    token: string,
    ip: string
  ): { success: boolean; targetUrl?: string; error?: string } {
    if (token && token.includes(".")) {
      return this.resolveGateway(token, ip);
    }
    return {
      success: false,
      error: "Session expired or invalid link. Please reload the claim page.",
    };
  },

  startStep(
    gatewayToken: string,
    ip: string
  ): {
    success: boolean;
    activeStepToken?: string;
    targetUrl?: string;
    duration?: number;
    stepIndex?: number;
    powChallenge?: { nonce: string; difficulty: number };
    error?: string;
  } {
    const res = verifySignedToken<GatewayTokenPayload>(gatewayToken);
    if (!res.valid || !res.payload) {
      return { success: false, error: res.error || "Invalid task gateway token." };
    }

    const payload = res.payload;
    if (payload.t !== "gw") {
      return { success: false, error: "Invalid token type." };
    }

    if (!isIpMatching(payload.ip, ip)) {
      return {
        success: false,
        error: "Network mismatch detected: Task must be opened from the claiming IP.",
      };
    }

    const powChallenge = generatePoWChallenge(3);

    // Stamp current server clock timestamp for strict temporal verification
    const activePayload: ActiveStepTokenPayload = {
      t: "active",
      sid: payload.sid,
      step: payload.step,
      total: payload.total,
      ip,
      startedAt: Date.now(),
      duration: payload.duration,
      scriptId: payload.scriptId,
      powNonce: powChallenge.nonce,
      powDifficulty: powChallenge.difficulty,
      exp: Date.now() + 45 * 60 * 1000,
    };

    const activeStepToken = createSignedToken(activePayload);

    return {
      success: true,
      activeStepToken,
      targetUrl: payload.targetUrl,
      duration: payload.duration,
      stepIndex: payload.step,
      powChallenge,
    };
  },

  verifyStep(
    activeStepToken: string,
    ip: string,
    powSolution: string,
    powNonce?: string
  ): {
    success: boolean;
    allCompleted?: boolean;
    nextStep?: number;
    nextStepToken?: string;
    nextPowChallenge?: { nonce: string; difficulty: number };
    claimToken?: string;
    error?: string;
    bypassDetected?: boolean;
    remainingSeconds?: number;
  } {
    const res = verifySignedToken<ActiveStepTokenPayload>(activeStepToken);
    if (!res.valid || !res.payload) {
      return {
        success: false,
        bypassDetected: true,
        error: res.error || "Active step token invalid or expired. Please click 'Visit Task' again.",
      };
    }

    const payload = res.payload;
    if (payload.t !== "active") {
      return { success: false, bypassDetected: true, error: "Invalid step token type." };
    }

    if (!isIpMatching(payload.ip, ip)) {
      return {
        success: false,
        bypassDetected: true,
        error: "Network mismatch: Verification request originated from an unrecognized IP.",
      };
    }

    // Strict Server-Side Dwell Time Enforcement
    const elapsedSec = (Date.now() - payload.startedAt) / 1000;
    const requiredSec = payload.duration;

    // Allow 1.0 second tolerance for network latency, strictly block anything faster
    if (elapsedSec < requiredSec - 1.0) {
      const remaining = Math.ceil(requiredSec - elapsedSec);
      return {
        success: false,
        bypassDetected: true,
        remainingSeconds: remaining,
        error: `Temporal anomaly detected: Task completed unnaturally fast (${Math.floor(
          elapsedSec
        )}s < ${requiredSec}s). Please spend ${remaining} more seconds on the task.`,
      };
    }

    // Proof-of-Work Challenge Verification
    const nonceToVerify = payload.powNonce || powNonce || "";
    const difficultyToVerify = payload.powDifficulty || 3;
    if (nonceToVerify) {
      const powValid = verifyPoWSolution(nonceToVerify, powSolution, difficultyToVerify);
      if (!powValid) {
        return {
          success: false,
          bypassDetected: true,
          error: "Anti-bot challenge failed. Automated scripts and bypassers are prohibited.",
        };
      }
    }

    const isLastStep = payload.step >= payload.total - 1;

    if (isLastStep) {
      // All checkpoints completed legitimately! Issue cryptographically signed claim token
      const claimPayload: ClaimTokenPayload = {
        t: "claim",
        sid: payload.sid,
        scriptId: payload.scriptId,
        ip,
        completedAt: Date.now(),
        exp: Date.now() + 15 * 60 * 1000, // 15 minutes to claim
      };
      const claimToken = createSignedToken(claimPayload);

      return {
        success: true,
        allCompleted: true,
        claimToken,
      };
    } else {
      const nextStepIndex = payload.step + 1;
      const nextPow = generatePoWChallenge(3);

      return {
        success: true,
        allCompleted: false,
        nextStep: nextStepIndex,
        nextPowChallenge: nextPow,
      };
    }
  },

  verifyAndConsumeClaimToken(
    sessionId: string,
    claimToken: string,
    ip: string,
    scriptId: string
  ): { valid: boolean; error?: string } {
    const res = verifySignedToken<ClaimTokenPayload>(claimToken);
    if (!res.valid || !res.payload) {
      return { valid: false, error: res.error || "Invalid or expired checkpoint authorization token." };
    }

    const payload = res.payload;
    if (payload.t !== "claim") {
      return { valid: false, error: "Invalid token type." };
    }

    if (!isIpMatching(payload.ip, ip)) {
      return { valid: false, error: "Claim IP address does not match verified checkpoint IP." };
    }

    // Replay attack check
    if (consumedClaimTokens.has(claimToken)) {
      return { valid: false, error: "This claim authorization token has already been consumed." };
    }

    // Prevent token reuse
    consumedClaimTokens.add(claimToken);
    if (consumedClaimTokens.size > 5000) {
      const first = consumedClaimTokens.values().next().value;
      if (first) consumedClaimTokens.delete(first);
    }

    return { valid: true };
  },
};
