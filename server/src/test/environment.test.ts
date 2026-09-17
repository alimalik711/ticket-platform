import {
  describe,
  expect,
  it,
} from "vitest";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

describe("Test Environment", () => {
  it("uses the test database ticket_platform_test", async () => {
    expect(env.DATABASE_URL).toContain("ticket_platform_test");

    const result = await pool.query<{ current_database: string }>(
      "SELECT current_database()",
    );

    expect(result.rows[0]?.current_database).toBe("ticket_platform_test");
  });
});
