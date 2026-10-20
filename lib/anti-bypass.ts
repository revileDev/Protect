// lib/anti-bypass.ts
import crypto from "crypto";
import type { CheckpointItem } from "./store";

const HMAC_SECRET =
  process.env.ANTI_BYPASS_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "atomprotect_anti_bypass_fortress_secure_salt_791823";

export interface CheckpointSession {
  id: string;
  ip: string;
  user_agent_hash: string;
  script_id: string;
  created_at: number;
  status: "in_progress" | "verified" | "claimed";
  current_step: number; // 0-indexed
  total_steps: number;
  step_checkpoints: Array<{
    id: string;
    title: string;
    url: string;
    duration_seconds: number;
    order: number;
    started_at?: number;
    gateway_visited?: boolean;
    completed?: boolean;
  }>;
  pow_challenge: {
    nonce: string;
    difficulty: number;
  };
  claim_token?: string;
  claimed_at?: number;
}

// Global in-memory session registry with 45-minute expiration
const sessions = new Map<string, CheckpointSession>();

// Cleanup stale sessions every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    sessions.forEach((sess, id) => {
      if (now - sess.created_at > 45 * 60 * 1000) {
        sessions.delete(id);
      }
    });
  }, 10 * 60 * 1000);
}

function hashUserAgent(ua: string): string {
  return crypto.createHash("sha256").update(ua || "unknown").digest("hex").slice(0, 16);
}

function signHmac(data: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(data).digest("hex");
}

function generatePoWChallenge(difficulty = 3): { nonce: string; difficulty: number } {
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
    }[];
    currentStepToken: string;
    powChallenge: { nonce: string; difficulty: number };
  } {
    const sessionId = crypto.randomUUID();
    const sorted = [...checkpoints].sort((a, b) => a.order - b.order);

    const stepCheckpoints = sorted.map((cp) => ({
      id: cp.id,
      title: cp.title,
      url: cp.url,
      duration_seconds: Math.max(5, Number(cp.duration_seconds) || 5),
      order: cp.order,
      gateway_visited: false,
      completed: false,
    }));

    const powChallenge = generatePoWChallenge(3);

    const session: CheckpointSession = {
      id: sessionId,
      ip,
      user_agent_hash: hashUserAgent(userAgent),
      script_id: scriptId,
      created_at: Date.now(),
      status: "in_progress",
      current_step: 0,
      total_steps: stepCheckpoints.length,
      step_checkpoints: stepCheckpoints,
      pow_challenge: powChallenge,
    };

    sessions.set(sessionId, session);

    const currentStepToken = signHmac(`${sessionId}:step:0:${ip}`);

    // Return sanitized step details with secure gateway URLs instead of raw URLs
    const stepDetails = stepCheckpoints.map((cp, idx) => ({
      id: cp.id,
      title: cp.title,
      duration_seconds: cp.duration_seconds,
      order: cp.order,
      gatewayUrl: `/api/checkpoints/gateway?session=${sessionId}&step=${idx}&token=${signHmac(
        `${sessionId}:gw:${idx}:${ip}`
      )}`,
    }));

    return {
      sessionId,
      totalSteps: stepCheckpoints.length,
      currentStep: 0,
      stepDetails,
      currentStepToken,
      powChallenge,
    };
  },

  getSession(sessionId: string): CheckpointSession | null {
    return sessions.get(sessionId) || null;
  },

  registerGatewayVisit(
    sessionId: string,
    stepIndex: number,
    token: string,
    ip: string
  ): { success: boolean; targetUrl?: string; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: "Session expired or invalid. Please reload the claim page." };
    }

    if (session.ip !== ip) {
      return { success: false, error: "IP address mismatch. Checkpoint must be completed on the same network." };
    }

    const expectedToken = signHmac(`${sessionId}:gw:${stepIndex}:${ip}`);
    if (token !== expectedToken) {
      return { success: false, error: "Invalid gateway verification signature." };
    }

    if (stepIndex < 0 || stepIndex >= session.step_checkpoints.length) {
      return { success: false, error: "Invalid step index." };
    }

    const step = session.step_checkpoints[stepIndex];
    step.gateway_visited = true;
    step.started_at = Date.now();

    return {
      success: true,
      targetUrl: step.url,
    };
  },

  verifyStep(
    sessionId: string,
    stepIndex: number,
    stepToken: string,
    ip: string,
    powSolution: string
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
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: "Session expired or invalid. Please reload the claim page." };
    }

    if (session.ip !== ip) {
      return {
        success: false,
        bypassDetected: true,
        error: "Network mismatch detected: Request originated from a different IP.",
      };
    }

    if (session.status !== "in_progress") {
      return { success: false, error: "This checkpoint session has already been finalized." };
    }

    if (stepIndex !== session.current_step) {
      return {
        success: false,
        bypassDetected: true,
        error: `Out-of-order execution detected. Please complete step ${session.current_step + 1} first.`,
      };
    }

    const expectedStepToken = signHmac(`${sessionId}:step:${stepIndex}:${ip}`);
    if (stepToken !== expectedStepToken) {
      return {
        success: false,
        bypassDetected: true,
        error: "Invalid cryptographic step signature. Tampering detected.",
      };
    }

    const step = session.step_checkpoints[stepIndex];
    if (!step) {
      return { success: false, error: "Step not found." };
    }

    // 1. Gateway visit check: user must actually open the task link
    if (!step.gateway_visited || !step.started_at) {
      return {
        success: false,
        bypassDetected: true,
        error: "Task link was not visited. You must click 'Visit Task' to complete this checkpoint.",
      };
    }

    // 2. Strict Temporal Dwell Time check (server clock authoritative)
    const elapsedSec = (Date.now() - step.started_at) / 1000;
    const requiredSec = step.duration_seconds;

    // Allow a tiny 1-second margin for latency, strictly reject anything faster
    if (elapsedSec < requiredSec - 1.0) {
      const remaining = Math.ceil(requiredSec - elapsedSec);
      return {
        success: false,
        bypassDetected: true,
        remainingSeconds: remaining,
        error: `Temporal anomaly detected: Task completed unnaturally fast (${Math.floor(
          elapsedSec
        )}s < ${requiredSec}s). Please wait ${remaining} more seconds on the task page.`,
      };
    }

    // 3. Proof of Work verification
    const powValid = verifyPoWSolution(
      session.pow_challenge.nonce,
      powSolution,
      session.pow_challenge.difficulty
    );
    if (!powValid) {
      return {
        success: false,
        bypassDetected: true,
        error: "Anti-bot proof-of-work challenge failed. Automated script detected.",
      };
    }

    // Step successfully completed
    step.completed = true;
    const isLastStep = stepIndex >= session.total_steps - 1;

    if (isLastStep) {
      session.status = "verified";
      const claimToken = signHmac(`${sessionId}:CLAIM_PERMIT:${session.script_id}:${ip}:${Date.now()}`);
      session.claim_token = claimToken;

      return {
        success: true,
        allCompleted: true,
        claimToken,
      };
    } else {
      session.current_step += 1;
      const nextStepIndex = session.current_step;
      const nextStepToken = signHmac(`${sessionId}:step:${nextStepIndex}:${ip}`);
      const nextPow = generatePoWChallenge(3);
      session.pow_challenge = nextPow;

      return {
        success: true,
        allCompleted: false,
        nextStep: nextStepIndex,
        nextStepToken,
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
    const session = sessions.get(sessionId);
    if (!session) {
      return { valid: false, error: "Checkpoint session not found. Please complete the checkpoints." };
    }

    if (session.status === "claimed") {
      return { valid: false, error: "This checkpoint claim token has already been consumed. Replay attacks are prohibited." };
    }

    if (session.status !== "verified") {
      return { valid: false, error: "Checkpoints have not been verified by the security engine." };
    }

    if (session.ip !== ip) {
      return { valid: false, error: "Claim IP address does not match verified checkpoint IP." };
    }

    if (session.claim_token !== claimToken) {
      return { valid: false, error: "Invalid claim authorization token." };
    }

    // Check token age (15 minute validity)
    if (Date.now() - session.created_at > 15 * 60 * 1000) {
      return { valid: false, error: "Claim token has expired. Checkpoints must be claimed within 15 minutes." };
    }

    // Consume session to prevent replay
    session.status = "claimed";
    session.claimed_at = Date.now();

    return { valid: true };
  },
};
