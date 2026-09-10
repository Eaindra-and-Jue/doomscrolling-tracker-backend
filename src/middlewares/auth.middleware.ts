import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireJwtSecret } from "../config/env.ts";

const REFRESH_TOKEN_BYTES = 64;
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;

export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

type AuthUserProfile = {
  username: string;
  email: string;
};

type AuthTokenPayload = {
  sub: string;
} & AuthUserProfile;

export type AuthenticatedUser = {
  id: number;
} & AuthUserProfile;

export function createAuthToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      username: user.username,
      email: user.email,
    },
    requireJwtSecret(),
    {
      subject: String(user.id),
      expiresIn: "15m",
    },
  );
}

export function createRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

export function getRefreshTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.header("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    response.status(401).json({ error: "Bearer token is required" });
    return;
  }

  try {
    const payload = jwt.verify(token, requireJwtSecret()) as AuthTokenPayload;
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId)) {
      response.status(401).json({ error: "Invalid authentication token" });
      return;
    }

    request.authUser = {
      id: userId,
      username: payload.username,
      email: payload.email,
    };

    next();
  } catch {
    response.status(401).json({ error: "Invalid authentication token" });
  }
}
