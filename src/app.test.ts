import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app.ts";
import { prisma } from "./db/prisma.ts";

describe("app routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responds to GET /health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "doomscrolling-tracker-backend",
    });
  });

  it("serves Swagger UI", async () => {
    const response = await request(app).get("/docs/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Swagger UI");
  });

  it("documents all user-application operations", async () => {
    const response = await request(app).get("/docs.json");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.0");
    expect(response.body.paths["/api/user-applications"]).toMatchObject({
      get: {
        security: [{ bearerAuth: [] }],
      },
      post: {
        security: [{ bearerAuth: [] }],
      },
    });
    expect(response.body.paths["/api/user-applications/{id}"]).toMatchObject({
      put: {
        security: [{ bearerAuth: [] }],
      },
      delete: {
        security: [{ bearerAuth: [] }],
      },
    });
    expect(response.body.components.schemas).toHaveProperty("UserApplication");
    expect(response.body.components.schemas).toHaveProperty("UserApplicationRequest");
    expect(response.body.components.schemas).toHaveProperty("ErrorResponse");
    expect(response.body.paths["/api/auth/register"].post.tags).toEqual(["Authentication"]);
    expect(response.body.paths["/api/auth/login"].post.tags).toEqual(["Authentication"]);
    expect(response.body.paths["/api/auth/me"].get.tags).toEqual(["Authentication"]);
    expect(response.body.paths["/applications"].get.tags).toEqual(["Applications"]);
  });

  it("responds to GET /health/db when the database is available", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce(1);
    const response = await request(app).get("/health/db");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      database: "connected",
    });
  });

  it("returns 500 when the database check fails", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("db error"));
    const response = await request(app).get("/health/db");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Internal server error",
    });
  });
});
