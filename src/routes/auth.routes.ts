import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { prisma } from "../db/prisma.ts";
import { createAuthToken, requireAuth } from "../middlewares/auth.middleware.ts";

const SALT_ROUNDS = 12;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_SUCCESS_MESSAGE = "If an account exists for that email, password reset instructions have been created.";

class ResetTokenAlreadyUsedError extends Error {}

export const authRouter = Router();

type RegisterRequestBody = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

type LoginRequestBody = {
  identifier?: unknown;
  password?: unknown;
};

type ForgotPasswordRequestBody = {
  email?: unknown;
};

type ResetPasswordRequestBody = {
  token?: unknown;
  newPassword?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: testuser
 *               email:
 *                 type: string
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     streakCount:
 *                       type: integer
 *                 token:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Username or email already exists
 */
authRouter.post("/register", async (request, response, next) => {
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

    return response.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Log in an existing user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Username or email address
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     streakCount:
 *                       type: integer
 *                 token:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account is inactive
 */
authRouter.post("/login", async (request, response, next) => {
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

    return response.json({ user: authenticatedUser, token });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request a password reset
 *     description: Always returns the same response so registered email addresses are not exposed. Email delivery will be added separately.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *     responses:
 *       200:
 *         description: Password reset request accepted
 *       400:
 *         description: Email is missing
 */
authRouter.post("/forgot-password", async (request, response, next) => {
  try {
    const { email } = request.body as ForgotPasswordRequestBody;

    if (!isNonEmptyString(email)) {
      return response.status(400).json({ error: "email is required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (user) {
      const resetToken = randomBytes(32).toString("hex");

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(resetToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });

      // Pass resetToken to the email delivery service once that integration is available.
    }

    return response.json({ message: PASSWORD_RESET_SUCCESS_MESSAGE });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset a password using a one-time token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: new-password123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Missing fields or invalid, expired, or already-used token
 *       403:
 *         description: Account is inactive or deleted
 */
authRouter.post("/reset-password", async (request, response, next) => {
  try {
    const { token, newPassword } = request.body as ResetPasswordRequestBody;

    if (!isNonEmptyString(token) || !isNonEmptyString(newPassword)) {
      return response.status(400).json({ error: "token and newPassword are required" });
    }

    const passwordResetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!passwordResetToken || passwordResetToken.usedAt || passwordResetToken.expiresAt <= new Date()) {
      return response.status(400).json({ error: "Reset token is invalid or expired" });
    }

    if (!passwordResetToken.user.isActive || passwordResetToken.user.deletedAt) {
      return response.status(403).json({ error: "Account is inactive" });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const usedAt = new Date();

    try {
      await prisma.$transaction(async (transaction) => {
        const claimedToken = await transaction.passwordResetToken.updateMany({
          where: {
            id: passwordResetToken.id,
            usedAt: null,
            expiresAt: { gt: usedAt },
          },
          data: { usedAt },
        });

        if (claimedToken.count !== 1) {
          throw new ResetTokenAlreadyUsedError();
        }

        await transaction.user.update({
          where: { id: passwordResetToken.user.id },
          data: { passwordHash },
        });
      });
    } catch (error) {
      if (error instanceof ResetTokenAlreadyUsedError) {
        return response.status(400).json({ error: "Reset token is invalid or expired" });
      }

      throw error;
    }

    return response.json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns current user
 *       401:
 *         description: Missing or invalid token
 */
authRouter.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.authUser });
});
