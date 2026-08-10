import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.ts";

describe("user application routes", () => {
  it("rejects requests without a bearer token", async () => {
    const response = await request(app).get("/api/user-applications");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Bearer token is required",
    });
  });
});
