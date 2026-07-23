import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app.ts";
import { prisma } from "./db/prisma.ts";

describe("app routes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("responds to GET /health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "doomscrolling-tracker-backend",
    });
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
