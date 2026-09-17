import {
  describe,
  expect,
  it,
} from "vitest";

import request from "supertest";

import { app } from "../app.js";

describe("GET /health", () => {
  it("returns a successful health response", async () => {
    const response = await request(app)
      .get("/health");

    expect(response.status).toBe(200);
  });
});