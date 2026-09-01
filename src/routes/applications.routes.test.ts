import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma.ts";
import { app } from "../app.ts";
import request from "supertest";

describe("GET /applications", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("return a list of applications", async () => {
    const mockApplications = [
      { id: 1, name: "App 1", platform: "iOS", packageName: "com.app1" },
      { id: 2, name: "App 2", platform: "Android", packageName: "com.app2" },
    ];

    vi.spyOn(prisma.application, "count").mockResolvedValueOnce(2);
    vi.spyOn(prisma.application, "findMany").mockResolvedValueOnce(
      mockApplications,
    );

    const response = await request(app).get("/applications");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
        data: mockApplications,
        page: 1,
        perPage: 20,
        total: 2
    });
  });

  it("return an empty array when no applications exist", async () => {
    vi.spyOn(prisma.application, "count").mockResolvedValueOnce(0);
    vi.spyOn(prisma.application, "findMany").mockResolvedValueOnce([]);

    const response = await request(app).get("/applications");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      page: 1,
      perPage: 20,
      total: 0,
    });
  });
});
