import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthTokenPayload = {
  userId: string;
  organizationId: string;
  role: string;
  displayName: string;
  exp: number;
};

const secret = process.env.JWT_SECRET ?? process.env.AUTH_TOKEN_SECRET ?? "astralink-staging-secret";

function base64url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createToken(payload: Omit<AuthTokenPayload, "exp">, expiresInSeconds = 60 * 60 * 12) {
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
  const signature = signPayload(body);
  return `${body}.${signature}`;
}

export function verifyToken(token: string): AuthTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = signPayload(body);
  if (signature.length !== expected.length) return null;
  const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!isValid) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AuthTokenPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
