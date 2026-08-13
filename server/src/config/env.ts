import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),


    DATABASE_URL: z
    .string()
    .regex(
      /^postgres(?:ql)?:\/\//,
      "DATABASE_URL must be a PostgreSQL connection URL",
    ),

    BETTER_AUTH_SECRET: z.string().min(32),

    BETTER_AUTH_URL: z.string().url(),

    REDIS_URL: z
  .string()
  .regex(
    /^rediss?:\/\//,
    "REDIS_URL must be a Redis connection URL",
  ),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    "Invalid environment configuration:",
    result.error.issues,
  );

  throw new Error("Application configuration is invalid");
}

export const env = result.data;