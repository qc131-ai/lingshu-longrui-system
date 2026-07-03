import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${PREFIX}:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith(`${PREFIX}:`)) return stored === password;
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = scryptSync(password, salt, 64);
  const actual = Buffer.from(hash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
