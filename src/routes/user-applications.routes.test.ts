import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyUserApplications: vi.fn(),
  findApplication: vi.fn(),
  findUniqueUserApplication: vi.fn(),
  createUserApplication: vi.fn(),

  findOwnedUserApplication: vi.fn(),
  updateUserApplication: vi.fn(),

  deleteUserApplication: vi.fn(),
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
      findFirst: mocks.findOwnedUserApplication,
      update: mocks.updateUserApplication,
      delete: mocks.deleteUserApplication,
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
    vi.resetAllMocks();
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

  describe("PUT /api/user-applications/:id", () => {
    it("updates an application relationship owned by the authenticated user", async () => {
      // Arrange: relationship 10 belongs to user 1
      mocks.findOwnedUserApplication.mockResolvedValue({
        id: 10,
        userId: 1,
        applicationId: 2,
      });

      // Arrange: the new application exists
      mocks.findApplication.mockResolvedValue({
        id: 3,
        name: "YouTube",
        platform: "android",
        packageName: "youtube.example.com",
      });

      // Arrange: user 1 does not already have application 3
      mocks.findUniqueUserApplication.mockResolvedValue(null);

      mocks.updateUserApplication.mockResolvedValue({
        id: 10,
        userId: 1,
        applicationId: 3,
        application: {
          id: 3,
          name: "YouTube",
          platform: "android",
          packageName: "youtube.example.com",
        },
      });

      const response = await request(app)
        .put("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          applicationId: 3,
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        userApplication: {
          id: 10,
          userId: 1,
          applicationId: 3,
          application: {
            id: 3,
            name: "YouTube",
            platform: "android",
            packageName: "youtube.example.com",
          },
        },
      });

      expect(mocks.updateUserApplication).toHaveBeenCalledWith({
        where: {
          id: 10,
        },
        data: {
          applicationId: 3,
        },
        include: {
          application: true,
        },
      });
    });

    it("returns 400 when the relationship ID is invalid", async () => {
      const response = await request(app)
        .put("/api/user-applications/abc")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          applicationId: 3,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        error: "id must be a positive integer",
      });

      expect(mocks.findOwnedUserApplication).not.toHaveBeenCalled();
      expect(mocks.updateUserApplication).not.toHaveBeenCalled();
    });

    it("returns 400 when the application ID is invalid", async () => {
      const response = await request(app)
        .put("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          applicationId: "abc",
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "applicationId must be a positive integer",
      });
      expect(mocks.findOwnedUserApplication).not.toHaveBeenCalled();
      expect(mocks.updateUserApplication).not.toHaveBeenCalled();
    });

    it("returns 404 when the relationship is not accessible to the authenticated user", async () => {
      mocks.findOwnedUserApplication.mockResolvedValue(null);
      const response = await request(app)
        .put("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          applicationId: 3,
        });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({
        error: "User application not found",
      });
      expect(mocks.updateUserApplication).not.toHaveBeenCalled();
    });

    it("returns 404 when the application is not found", async () => {
      mocks.findOwnedUserApplication.mockResolvedValue({
        id: 10,
        userId: 1,
        applicationId: 2,
      });
      mocks.findApplication.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          applicationId: 10,
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "Application not found",
      });
      expect(mocks.findUniqueUserApplication).not.toHaveBeenCalled();
      expect(mocks.updateUserApplication).not.toHaveBeenCalled();
    });

    it("returns 409 when another relationship already uses the requested application", async () => {
      mocks.findOwnedUserApplication.mockResolvedValue({
        id: 10,
        userId: 1,
        applicationId: 2,
      });

      mocks.findApplication.mockResolvedValue({
        id: 3,
        name: "YouTube",
        platform: "android",
        packageName: "youtube.example.com",
      });

      mocks.findUniqueUserApplication.mockResolvedValue({
        id: 11,
        userId: 1,
        applicationId: 3,
      });

      const response = await request(app)
        .put("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          applicationId: 3,
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: "Application is already assigned to this user",
      });
      expect(mocks.updateUserApplication).not.toHaveBeenCalled();
    });

    it("returns 200 when the relationship already uses the requested application", async () => {
      const existingRelationship = {
        id: 10,
        userId: 1,
        applicationId: 3,
      };
      const application = {
        id: 3,
        name: "YouTube",
        platform: "android",
        packageName: "youtube.example.com",
      };

      mocks.findOwnedUserApplication.mockResolvedValue(existingRelationship);
      mocks.findApplication.mockResolvedValue(application);
      mocks.updateUserApplication.mockResolvedValue({
        ...existingRelationship,
        application,
      });

      const response = await request(app)
        .put("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          applicationId: 3,
        });

      expect(response.status).toBe(200);
      expect(mocks.findUniqueUserApplication).not.toHaveBeenCalled();
      expect(mocks.updateUserApplication).toHaveBeenCalledWith({
        where: {
          id: 10,
        },
        data: {
          applicationId: 3,
        },
        include: {
          application: true,
        },
      });
    });
  });

  describe("DELETE /api/user-applications/:id", () => {
    it("returns 400 when the relationship ID is invalid", async () => {
      const response = await request(app)
        .delete("/api/user-applications/abc")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "id must be a positive integer",
      });
      expect(mocks.findOwnedUserApplication).not.toHaveBeenCalled();
      expect(mocks.deleteUserApplication).not.toHaveBeenCalled();
    });

    it("returns 404 when the relationship is not accessible to the authenticated user", async () => {
      mocks.findOwnedUserApplication.mockResolvedValue(null);
      const response = await request(app)
        .delete("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "User application not found",
      });
      expect(mocks.deleteUserApplication).not.toHaveBeenCalled();
    });

    it("returns 204 when the user application was deleted successfully", async () => {
      mocks.findOwnedUserApplication.mockResolvedValue({
        id: 10,
        userId: 1,
        applicationId: 3,
      });

      const response = await request(app)
        .delete("/api/user-applications/10")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(mocks.findOwnedUserApplication).toHaveBeenCalledWith({
        where: {
          id: 10,
          userId: 1,
        },
      });
      expect(mocks.deleteUserApplication).toHaveBeenCalledWith({
        where: {
          id: 10,
          userId: 1,
        },
      });
    });
  });
});
