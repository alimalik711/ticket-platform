import { betterAuth } from "better-auth";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

const auth = betterAuth({
  database: pool,

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
  },
});

export { auth };