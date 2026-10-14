// lib/auth.ts
import { cookies } from "next/headers";

export const ADMIN_USERNAME = "Revile2120516501";
export const ADMIN_PASSWORD = "2120516501Id@y6y7y8y9pl";

// Deterministic auth token based on credentials
export const AUTH_COOKIE_NAME = "aero_admin_session";
export const AUTH_TOKEN_VALUE = "revile_auth_session_92103f8a619c";

export function verifyCredentials(user: string, pass: string): boolean {
  return user === ADMIN_USERNAME && pass === ADMIN_PASSWORD;
}

export function isAuthenticated(): boolean {
  const cookieStore = cookies();
  const session = cookieStore.get(AUTH_COOKIE_NAME);
  return session?.value === AUTH_TOKEN_VALUE;
}
