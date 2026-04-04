import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import type { User, UserRole } from "./types.js";

type AuthTokenPayload = {
  userId: string;
  email: string;
  role: UserRole;
};

const toBase64Url = (value: string): string =>
  Buffer.from(value, "utf-8").toString("base64url");

const fromBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf-8");

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, encoded: string): boolean => {
  const [salt, savedHash] = encoded.split(":");
  if (!salt || !savedHash) {
    return false;
  }
  const checkHash = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(savedHash, "hex");
  const b = Buffer.from(checkHash, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
};

export const createAccessToken = (user: Pick<User, "id" | "email" | "role">): string => {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
    } satisfies AuthTokenPayload & { exp: number })
  );
  const signature = createHmac("sha256", config.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
};

export const verifyAccessToken = (token: string): AuthTokenPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", config.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  const a = Buffer.from(signature, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64Url(payload)) as AuthTokenPayload & { exp: number };
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch {
    return null;
  }
};
