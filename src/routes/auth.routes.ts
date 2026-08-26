import bcrypt from "bcryptjs";
import { Router } from "express";
import { prisma } from "../db/prisma.ts";
import { createAuthToken, requireAuth } from "../middlewares/auth.middleware.ts";

const SALT_ROUNDS = 12;

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
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
        deletedAt: true,
      },
    });

    if (!user) {
      return response.status(401).json({
        error: "Invalid credentials",
      });
    }

    if (!user.isActive || user.deletedAt) {
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
 * /api/auth/me:
 *   get:
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
