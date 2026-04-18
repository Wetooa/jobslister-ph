import { createHash, timingSafeEqual } from "crypto";

const SESSION_INPUT_PREFIX = "jobsph-admin:";

export function isAdminPasswordConfigured(): boolean {
  const p = process.env.ADMIN_PASSWORD;
  return typeof p === "string" && p.length > 0;
}

/** Deterministic opaque token derived from ADMIN_PASSWORD (never send password to client). */
export function getAdminSessionToken(): string | null {
  if (!isAdminPasswordConfigured()) return null;
  const p = process.env.ADMIN_PASSWORD as string;
  return createHash("sha256")
    .update(SESSION_INPUT_PREFIX + p, "utf8")
    .digest("hex");
}

export function verifyAdminPassword(provided: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyAdminSessionToken(token: string): boolean {
  const expected = getAdminSessionToken();
  if (!expected) return false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(token, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
