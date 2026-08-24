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

  RESERVATION_RATE_LIMIT_MAX: z.coerce
  .number()
  .int()
  .positive()
  .default(5),

RESERVATION_RATE_LIMIT_WINDOW_SECONDS: z.coerce
  .number()
  .int()
  .positive()
  .default(60),

  EVENT_SEATS_CACHE_TTL_SECONDS: z.coerce
  .number()
  .int()
  .positive()
  .default(15),

  STRIPE_SECRET_KEY: z
  .string()
  .min(
    1,
    "STRIPE_SECRET_KEY is required",
  ),

STRIPE_API_HOST: z
  .string()
  .min(1)
  .default("api.stripe.com"),

STRIPE_API_PORT: z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .default(443),

STRIPE_API_PROTOCOL: z
  .enum(["http", "https"])
  .default("https"),


STRIPE_WEBHOOK_SECRET: z
  .string()
  .min(
    1,
    "STRIPE_WEBHOOK_SECRET is required",
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