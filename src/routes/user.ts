import bcrypt from "bcryptjs";
import type { Response } from "express";
import { Router } from "express";
import { env } from "../config/env.ts";
import { prisma } from "../db/prisma.ts";
import {
  createAuthToken,
  createRefreshToken,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  requireAuth,
} from "../middleware/auth.ts";

const SALT_ROUNDS = 12;

export const userRouter = Router();

type RegisterRequestBody = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

type LoginRequestBody = {
  identifier?: unknown;
  password?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function setRefreshTokenCookie(response: Response, refreshToken: string, expiresAt: Date): void {
  response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    expires: expiresAt,
    httpOnly: true,
    path: "/api/auth",
    sameSite: "lax",
    secure: env.nodeEnv === "production",
  });
}

function clearRefreshTokenCookie(response: Response): void {
  response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    path: "/api/auth",
    sameSite: "lax",
    secure: env.nodeEnv === "production",
  });
}

async function createStoredRefreshToken(userId: number, response: Response): Promise<void> {
  const refreshToken = createRefreshToken();
  const expiresAt = getRefreshTokenExpiresAt();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    },
    select: {
      id: true,
    },
  });
  setRefreshTokenCookie(response, refreshToken, expiresAt);
}

userRouter.post("/register", async (request, response, next) => {
  try {
    const { username, email, password } = request.body as RegisterRequestBody;

    if (!isNonEmptyString(username) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      return response.status(400).json({
        error: "username, email, and password are required",
      });
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: normalizedUsername }, { email: normalizedEmail }],
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (existingUser) {
      const field = existingUser.username === normalizedUsername ? "username" : "email";

      return response.status(409).json({
        error: `${field} already exists`,
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        email: true,
        streakCount: true,
      },
    });
    const token = createAuthToken(user);
    await createStoredRefreshToken(user.id, response);

    return response.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
});

userRouter.post("/login", async (request, response, next) => {
  try {
    const { identifier, password } = request.body as LoginRequestBody;

    if (!isNonEmptyString(identifier) || !isNonEmptyString(password)) {
      return response.status(400).json({
        error: "identifier and password are required",
      });
    }

    const normalizedIdentifier = identifier.trim();
    const normalizedEmail = normalizedIdentifier.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: normalizedIdentifier }, { email: normalizedEmail }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        streakCount: true,
        isActive: true,
      },
    });

    if (!user) {
      return response.status(401).json({
        error: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      return response.status(403).json({
        error: "Account is inactive",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return response.status(401).json({
        error: "Invalid credentials",
      });
    }

    const authenticatedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      streakCount: user.streakCount,
    };
    const token = createAuthToken(authenticatedUser);
    await createStoredRefreshToken(user.id, response);

    return response.json({ user: authenticatedUser, token });
  } catch (error) {
    next(error);
  }
});

userRouter.post("/refresh", async (request, response, next) => {
  try {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (!isNonEmptyString(refreshToken)) {
      return response.status(401).json({
        error: "Refresh token is required",
      });
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const storedRefreshToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            streakCount: true,
            isActive: true,
          },
        },
      },
    });

    if (!storedRefreshToken || storedRefreshToken.revokedAt || storedRefreshToken.expiresAt <= new Date()) {
      clearRefreshTokenCookie(response);

      return response.status(401).json({
        error: "Invalid refresh token",
      });
    }

    if (!storedRefreshToken.user.isActive) {
      clearRefreshTokenCookie(response);

      return response.status(403).json({
        error: "Account is inactive",
      });
    }

    await prisma.refreshToken.update({
      where: {
        id: storedRefreshToken.id,
      },
      data: {
        revokedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    const user = {
      id: storedRefreshToken.user.id,
      username: storedRefreshToken.user.username,
      email: storedRefreshToken.user.email,
      streakCount: storedRefreshToken.user.streakCount,
    };
    const token = createAuthToken(user);
    await createStoredRefreshToken(user.id, response);

    return response.json({ user, token });
  } catch (error) {
    next(error);
  }
});

userRouter.post("/logout", async (request, response, next) => {
  try {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (isNonEmptyString(refreshToken)) {
      await prisma.refreshToken.updateMany({
        where: {
          tokenHash: hashRefreshToken(refreshToken),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    clearRefreshTokenCookie(response);

    return response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

userRouter.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.authUser });
});
