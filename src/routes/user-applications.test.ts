import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyUserApplications: vi.fn(),
}));

vi.mock("../db/prisma.ts", () => ({
  prisma: {
    applicationUser: {
      findMany: mocks.findManyUserApplications,
    },
  },
}));

const { app } = await import("../app.ts");

function createToken(): string {
  return jwt.sign(
    {
      username: "testuser",
      email: "test@example.com",
    },
    "test-secret",
    {
      subject: "1",
    },
  );
}

describe("user application routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    vi.clearAllMocks();
  });

  it("rejects requests without a bearer token", async () => {
    const response = await request(app).get("/api/user-applications");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Bearer token is required",
    });
  });

  it("lists applications belonging to the authenticated user", async () => {
    mocks.findManyUserApplications.mockResolvedValue([
      {
        id: 10,
        userId: 1,
        applicationId: 7,
        application: {
          id: 7,
          name: "YouTube",
          platform: "android",
          packageName: "com.google.android.youtube",
        },
      },
    ]);

    const response = await request(app)
      .get("/api/user-applications")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userApplications: [
        {
          id: 10,
          userId: 1,
          applicationId: 7,
          application: {
            id: 7,
            name: "YouTube",
            platform: "android",
            packageName: "com.google.android.youtube",
          },
        },
      ],
    });
    expect(mocks.findManyUserApplications).toHaveBeenCalledWith({
      where: {
        userId: 1,
      },
      include: {
        application: true,
      },
      orderBy: {
        id: "asc",
      },
    });
  });
});
