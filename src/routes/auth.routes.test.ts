import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashRefreshToken, REFRESH_TOKEN_COOKIE_NAME } from "../middlewares/auth.middleware.ts";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  findUser: vi.fn(),
  createRefreshToken: vi.fn(),
  findRefreshToken: vi.fn(),
  updateRefreshToken: vi.fn(),
  updateManyRefreshToken: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../db/prisma.ts", () => ({
  prisma: {
    user: {
      create: mocks.createUser,
      findFirst: mocks.findUser,
    },
    refreshToken: {
      create: mocks.createRefreshToken,
      findFirst: mocks.findRefreshToken,
      update: mocks.updateRefreshToken,
      updateMany: mocks.updateManyRefreshToken,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mocks.comparePassword,
    hash: mocks.hashPassword,
  },
}));

const { app } = await import("../app.ts");

describe("user routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mocks.comparePassword.mockResolvedValue(true);
    mocks.createRefreshToken.mockResolvedValue({ id: 1 });
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.updateRefreshToken.mockResolvedValue({ id: 1 });
    mocks.updateManyRefreshToken.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    vi.clearAllMocks();
  });

  it("registers a new user", async () => {
    mocks.findUser.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({
      id: 1,
      username: "testuser",
      email: "test@example.com",
      streakCount: 0,
    });

    const response = await request(app).post("/api/auth/register").send({
      username: " testuser ",
      email: "TEST@example.com",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        streakCount: 0,
      },
      token: expect.any(String),
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(jwt.verify(response.body.token, "test-secret")).toMatchObject({
      sub: "1",
      username: "testuser",
      email: "test@example.com",
    });
    expect(mocks.hashPassword).toHaveBeenCalledWith("password123", 12);
    expect(mocks.createUser).toHaveBeenCalledWith({
      data: {
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hashed-password",
      },
      select: {
        id: true,
        username: true,
        email: true,
        streakCount: true,
      },
    });
    expect(mocks.createRefreshToken).toHaveBeenCalledWith({
      data: {
        userId: 1,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
      select: {
        id: true,
      },
    });
    expect(response.headers["set-cookie"][0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("rejects missing required fields", async () => {
    const response = await request(app).post("/api/auth/register").send({
      username: "testuser",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "username, email, and password are required",
    });
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate username or email", async () => {
    mocks.findUser.mockResolvedValue({
      username: "testuser",
      email: "other@example.com",
    });

    const response = await request(app).post("/api/auth/register").send({
      username: "testuser",
      email: "test@example.com",
      password: "password123",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "username already exists",
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("logs in a user with email", async () => {
    mocks.findUser.mockResolvedValue({
      id: 1,
      username: "testuser",
      email: "test@example.com",
      passwordHash: "hashed-password",
      streakCount: 0,
      isActive: true,
    });

    const response = await request(app).post("/api/auth/login").send({
      identifier: "TEST@example.com",
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        streakCount: 0,
      },
      token: expect.any(String),
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(jwt.verify(response.body.token, "test-secret")).toMatchObject({
      sub: "1",
      username: "testuser",
      email: "test@example.com",
    });
    expect(mocks.findUser).toHaveBeenCalledWith({
      where: {
        OR: [{ username: "TEST@example.com" }, { email: "test@example.com" }],
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
    expect(mocks.comparePassword).toHaveBeenCalledWith("password123", "hashed-password");
    expect(mocks.createRefreshToken).toHaveBeenCalledWith({
      data: {
        userId: 1,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
      select: {
        id: true,
      },
    });
  });

  it("logs in a user with username", async () => {
    mocks.findUser.mockResolvedValue({
      id: 1,
      username: "testuser",
      email: "test@example.com",
      passwordHash: "hashed-password",
      streakCount: 0,
      isActive: true,
    });

    const response = await request(app).post("/api/auth/login").send({
      identifier: "testuser",
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 1,
      username: "testuser",
      email: "test@example.com",
      streakCount: 0,
    });
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("rejects login with missing required fields", async () => {
    const response = await request(app).post("/api/auth/login").send({
      identifier: "testuser",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "identifier and password are required",
    });
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.comparePassword).not.toHaveBeenCalled();
  });

  it("rejects login for an unknown user", async () => {
    mocks.findUser.mockResolvedValue(null);

    const response = await request(app).post("/api/auth/login").send({
      identifier: "missing@example.com",
      password: "password123",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Invalid credentials",
    });
    expect(mocks.comparePassword).not.toHaveBeenCalled();
  });

  it("rejects login with an invalid password", async () => {
    mocks.findUser.mockResolvedValue({
      id: 1,
      username: "testuser",
      email: "test@example.com",
      passwordHash: "hashed-password",
      streakCount: 0,
      isActive: true,
    });
    mocks.comparePassword.mockResolvedValue(false);

    const response = await request(app).post("/api/auth/login").send({
      identifier: "testuser",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Invalid credentials",
    });
  });

  it("rejects login for an inactive user", async () => {
    mocks.findUser.mockResolvedValue({
      id: 1,
      username: "testuser",
      email: "test@example.com",
      passwordHash: "hashed-password",
      streakCount: 0,
      isActive: false,
    });

    const response = await request(app).post("/api/auth/login").send({
      identifier: "testuser",
      password: "password123",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Account is inactive",
    });
    expect(mocks.comparePassword).not.toHaveBeenCalled();
  });

  it("refreshes an access token and rotates refresh token", async () => {
    const oldRefreshToken = "old-refresh-token";
    const oldRefreshTokenHash = hashRefreshToken(oldRefreshToken);
    mocks.findRefreshToken.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        streakCount: 0,
        isActive: true,
      },
    });

    const response = await request(app).post("/api/auth/refresh").set("Cookie", [
      `${REFRESH_TOKEN_COOKIE_NAME}=${oldRefreshToken}`,
    ]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        streakCount: 0,
      },
      token: expect.any(String),
    });
    expect(mocks.findRefreshToken).toHaveBeenCalledWith({
      where: {
        tokenHash: oldRefreshTokenHash,
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
    expect(mocks.updateRefreshToken).toHaveBeenCalledWith({
      where: {
        id: 1,
      },
      data: {
        revokedAt: expect.any(Date),
      },
      select: {
        id: true,
      },
    });
    expect(mocks.createRefreshToken).toHaveBeenCalledWith({
      data: {
        userId: 1,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
      select: {
        id: true,
      },
    });
    expect(response.headers["set-cookie"][0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("rejects refresh without a refresh token cookie", async () => {
    const response = await request(app).post("/api/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Refresh token is required",
    });
    expect(mocks.findRefreshToken).not.toHaveBeenCalled();
  });

  it("rejects refresh with an invalid refresh token", async () => {
    mocks.findRefreshToken.mockResolvedValue(null);

    const response = await request(app).post("/api/auth/refresh").set("Cookie", [
      `${REFRESH_TOKEN_COOKIE_NAME}=invalid-refresh-token`,
    ]);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Invalid refresh token",
    });
    expect(response.headers["set-cookie"][0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
  });

  it("rejects refresh with an expired refresh token", async () => {
    mocks.findRefreshToken.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        streakCount: 0,
        isActive: true,
      },
    });

    const response = await request(app).post("/api/auth/refresh").set("Cookie", [
      `${REFRESH_TOKEN_COOKIE_NAME}=expired-refresh-token`,
    ]);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Invalid refresh token",
    });
    expect(mocks.updateRefreshToken).not.toHaveBeenCalled();
  });

  it("rejects refresh with a revoked refresh token", async () => {
    mocks.findRefreshToken.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        streakCount: 0,
        isActive: true,
      },
    });

    const response = await request(app).post("/api/auth/refresh").set("Cookie", [
      `${REFRESH_TOKEN_COOKIE_NAME}=revoked-refresh-token`,
    ]);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Invalid refresh token",
    });
    expect(mocks.updateRefreshToken).not.toHaveBeenCalled();
  });

  it("rejects refresh for an inactive user", async () => {
    mocks.findRefreshToken.mockResolvedValue({
      id: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        streakCount: 0,
        isActive: false,
      },
    });

    const response = await request(app).post("/api/auth/refresh").set("Cookie", [
      `${REFRESH_TOKEN_COOKIE_NAME}=inactive-refresh-token`,
    ]);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Account is inactive",
    });
    expect(mocks.updateRefreshToken).not.toHaveBeenCalled();
  });

  it("logs out and clears the refresh token cookie", async () => {
    const refreshToken = "refresh-token";

    const response = await request(app).post("/api/auth/logout").set("Cookie", [
      `${REFRESH_TOKEN_COOKIE_NAME}=${refreshToken}`,
    ]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(mocks.updateManyRefreshToken).toHaveBeenCalledWith({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(response.headers["set-cookie"][0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
  });

  it("logs out successfully without a refresh token cookie", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(mocks.updateManyRefreshToken).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"][0]).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
  });

  it("rejects protected requests without a bearer token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Bearer token is required",
    });
  });

  it("returns authenticated user metadata for a valid bearer token", async () => {
    const token = jwt.sign(
      {
        username: "testuser",
        email: "test@example.com",
      },
      "test-secret",
      {
        subject: "1",
      },
    );

    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
      },
    });
  });
});
