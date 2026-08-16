import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyUserApplications: vi.fn(),
  findApplication: vi.fn(),
  findUniqueUserApplication: vi.fn(),
  createUserApplication: vi.fn(),
}));

vi.mock("../db/prisma.ts", () => ({
  prisma: {
    application: {
      findUnique: mocks.findApplication,
    },
    applicationUser: {
      findMany: mocks.findManyUserApplications,
      findUnique: mocks.findUniqueUserApplication,
      create: mocks.createUserApplication,
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

  it("add the application to the authenticated user", async () => {
    mocks.findApplication.mockResolvedValue({
      id: 7,
      name: "YouTube",
      platform: "android",
      packageName: "com.google.android.youtube",
    });

    mocks.findUniqueUserApplication.mockResolvedValue(null);

    mocks.createUserApplication.mockResolvedValue({
      id: 10,
      userId: 1,
      applicationId: 7,
      application: {
        id: 7,
        name: "YouTube",
        platform: "android",
        packageName: "com.google.android.youtube",
      },
    });

    const response = await request(app)
      .post("/api/user-applications")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ applicationId: 7 });

    expect(response.statusCode).toBe(201);

    expect(response.body).toEqual({
      userApplication: {
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
    });

    expect(mocks.createUserApplication).toHaveBeenCalledWith({
      data: {
        userId: 1,
        applicationId: 7,
      },
      include: {
        application: true,
      },
    });
  });

  it("rejects a missing applicationId", async () => {
    const response = await request(app)
      .post("/api/user-applications")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "applicationId must be a positive integer",
    });
  });

  it("reject an application already assigned to the user", async () => {
    mocks.findApplication.mockResolvedValue({
      id: 7,
      name: "YouTube",
      platform: "android",
      packageName: "com.google.android.youtube",
    });

    mocks.findUniqueUserApplication.mockResolvedValue({
      id: 10,
      userId: 1,
      applicationId: 7,
    });

    const response = await request(app)
      .post("/api/user-applications")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({
        applicationId: 7,
      });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      error: "Application is already assigned to this user",
    });

    expect(mocks.createUserApplication).not.toHaveBeenCalled();
  });
});
