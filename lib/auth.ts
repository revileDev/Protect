// lib/auth.ts
import { cookies } from "next/headers";
import { hmacSha256, constantTimeEquals } from "@/lib/crypto-util";

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Revile2120516501";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "2120516501Id@y6y7y8y9pl";

export const AUTH_COOKIE_NAME = "aero_admin_session";
// Legacy static token retained for backward compatibility
export const AUTH_TOKEN_VALUE = "revile_auth_session_92103f8a619c";

const AUTH_SECRET = process.env.AUTH_SECRET || "aero_admin_secret_hmac_key_92103f8a619c";

/**
 * Validates admin username and password against environment or secure defaults.
 */
export function verifyCredentials(user: string, pass: string): boolean {
  if (!user || !pass) return false;
  return user === ADMIN_USERNAME && pass === ADMIN_PASSWORD;
}

/**
 * Generates a cryptographically signed admin session token with timestamp.
 * Token format: <timestamp>.<signature>
 */
export function createSessionToken(): string {
  const timestamp = Date.now().toString();
  const signature = hmacSha256(AUTH_SECRET, `aero_admin:${timestamp}`);
  return `${timestamp}.${signature}`;
}

/**
 * Verifies if a given token is a valid, unexpired session token or valid legacy token.
 * Max token age: 7 days.
 */
export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;

  // Accept legacy token during transition
  if (token === AUTH_TOKEN_VALUE) return true;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - timestamp > SEVEN_DAYS_MS || Date.now() < timestamp - 60000) {
    return false;
  }

  const expectedSignature = hmacSha256(AUTH_SECRET, `aero_admin:${timestampStr}`);

  return constantTimeEquals(signature, expectedSignature);
}

/**
 * Checks whether the current request is authenticated as admin via cookies.
 */
export function isAuthenticated(): boolean {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    return isValidSessionToken(session);
  } catch {
    return false;
  }
}
