import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireJwtSecret } from "../config/env.ts";

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
      expiresIn: "1h",
    },
  );
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
