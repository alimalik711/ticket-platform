import {
  describe,
  expect,
  it,
} from "vitest";

import request from "supertest";

import { app } from "../app.js";

describe("GET /api/v1/events", () => {
  it("returns published events", async () => {
    const response = await request(app)
      .get("/api/v1/events");

    expect(response.status).toBe(200);

    expect(response.body.status).toBe("success");

    expect(response.body.data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111111",
          title: "Championship Final",
          venueName: "National Stadium",
          status: "PUBLISHED",
        }),
      ]),
    );
  });
});