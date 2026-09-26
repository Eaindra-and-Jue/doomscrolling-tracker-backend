import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  findUser: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
  createPasswordResetToken: vi.fn(),
  findPasswordResetToken: vi.fn(),
  claimPasswordResetToken: vi.fn(),
  updateUser: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../db/prisma.ts", () => ({
  prisma: {
    user: {
      create: mocks.createUser,
      findFirst: mocks.findUser,
      update: mocks.updateUser,
    },
    passwordResetToken: {
      create: mocks.createPasswordResetToken,
      findUnique: mocks.findPasswordResetToken,
      updateMany: mocks.claimPasswordResetToken,
    },
    $transaction: mocks.transaction,
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
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.createPasswordResetToken.mockResolvedValue({ id: 1 });
    mocks.updateUser.mockResolvedValue({ id: 1 });
    mocks.claimPasswordResetToken.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        user: { update: mocks.updateUser },
        passwordResetToken: { updateMany: mocks.claimPasswordResetToken },
      }),
    );
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

  it("creates a hashed password reset token for an active user", async () => {
    mocks.findUser.mockResolvedValue({ id: 1 });

    const response = await request(app).post("/api/auth/forgot-password").send({
      email: " TEST@example.com ",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "If an account exists for that email, password reset instructions have been created.",
    });
    expect(mocks.findUser).toHaveBeenCalledWith({
      where: {
        email: "test@example.com",
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.createPasswordResetToken).toHaveBeenCalledWith({
      data: {
        userId: 1,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      },
    });
    expect(response.body.token).toBeUndefined();
  });

  it("returns the same forgot-password response for an unknown email", async () => {
    mocks.findUser.mockResolvedValue(null);

    const response = await request(app).post("/api/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "If an account exists for that email, password reset instructions have been created.",
    });
    expect(mocks.createPasswordResetToken).not.toHaveBeenCalled();
  });

  it("rejects forgot-password when email is missing", async () => {
    const response = await request(app).post("/api/auth/forgot-password").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email is required" });
    expect(mocks.findUser).not.toHaveBeenCalled();
  });

  it("resets a password with a valid one-time token", async () => {
    mocks.findPasswordResetToken.mockResolvedValue({
      id: 10,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: {
        id: 1,
        isActive: true,
        deletedAt: null,
      },
    });
    mocks.hashPassword.mockResolvedValue("new-hashed-password");

    const response = await request(app).post("/api/auth/reset-password").send({
      token: "plain-reset-token",
      newPassword: "new-password123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Password reset successfully" });
    expect(mocks.findPasswordResetToken).toHaveBeenCalledWith({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
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
    expect(mocks.hashPassword).toHaveBeenCalledWith("new-password123", 12);
    expect(mocks.claimPasswordResetToken).toHaveBeenCalledWith({
      where: {
        id: 10,
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { passwordHash: "new-hashed-password" },
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it("allows only one request to consume a reset token", async () => {
    mocks.findPasswordResetToken.mockResolvedValue({
      id: 10,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: { id: 1, isActive: true, deletedAt: null },
    });
    mocks.claimPasswordResetToken.mockResolvedValue({ count: 0 });

    const response = await request(app).post("/api/auth/reset-password").send({
      token: "already-claimed-token",
      newPassword: "new-password123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Reset token is invalid or expired" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown", null],
    ["expired", { id: 10, expiresAt: new Date(0), usedAt: null, user: { id: 1, isActive: true, deletedAt: null } }],
    ["already used", { id: 10, expiresAt: new Date(Date.now() + 60_000), usedAt: new Date(), user: { id: 1, isActive: true, deletedAt: null } }],
  ])("rejects an %s reset token", async (_case, storedToken) => {
    mocks.findPasswordResetToken.mockResolvedValue(storedToken);

    const response = await request(app).post("/api/auth/reset-password").send({
      token: "invalid-reset-token",
      newPassword: "new-password123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Reset token is invalid or expired" });
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects reset-password for an inactive user", async () => {
    mocks.findPasswordResetToken.mockResolvedValue({
      id: 10,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: {
        id: 1,
        isActive: false,
        deletedAt: null,
      },
    });

    const response = await request(app).post("/api/auth/reset-password").send({
      token: "valid-reset-token",
      newPassword: "new-password123",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Account is inactive" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects reset-password when required fields are missing", async () => {
    const response = await request(app).post("/api/auth/reset-password").send({
      token: "reset-token",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "token and newPassword are required" });
    expect(mocks.findPasswordResetToken).not.toHaveBeenCalled();
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
