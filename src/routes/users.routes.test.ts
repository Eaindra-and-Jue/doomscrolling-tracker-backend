import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));

vi.mock("../db/prisma.ts", () => ({
  prisma: {
    user: {
      updateMany: mocks.updateUser,
    },
  },
}));

const { app } = await import("../app.ts");

function createToken(userId: number): string {
  return jwt.sign(
    {
      username: "testuser",
      email: "test@example.com",
    },
    "test-secret",
    {
      subject: String(userId),
    },
  );
}

describe("users routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    vi.clearAllMocks();
  });

  it("soft deletes the authenticated user's own account", async () => {
    mocks.updateUser.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .delete("/api/users/1")
      .set("Authorization", `Bearer ${createToken(1)}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: {
        id: 1,
        deletedAt: null,
        isActive: true,
      },
      data: {
        deletedAt: expect.any(Date),
        isActive: false,
      },
    });
  });

  it("rejects delete without a bearer token", async () => {
    const response = await request(app).delete("/api/users/1");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Bearer token is required",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects delete with an invalid user id", async () => {
    const response = await request(app)
      .delete("/api/users/not-a-number")
      .set("Authorization", `Bearer ${createToken(1)}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid user id",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects deleting another user's account", async () => {
    const response = await request(app)
      .delete("/api/users/2")
      .set("Authorization", `Bearer ${createToken(1)}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is missing or already deleted", async () => {
    mocks.updateUser.mockResolvedValue({ count: 0 });

    const response = await request(app)
      .delete("/api/users/1")
      .set("Authorization", `Bearer ${createToken(1)}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "User not found",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: {
        id: 1,
        deletedAt: null,
        isActive: true,
      },
      data: {
        deletedAt: expect.any(Date),
        isActive: false,
      },
    });
  });
});
