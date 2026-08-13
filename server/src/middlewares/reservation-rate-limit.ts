import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { redis } from "../redis/client.js";

const reservationRateLimit: RequestHandler = async (
  _request,
  response,
  next,
) => {
  try {
    const userId = response.locals.user.id;

    const now = Date.now();

    const windowMilliseconds =
      env.RESERVATION_RATE_LIMIT_WINDOW_SECONDS *
      1000;

    const windowStart =
      now - windowMilliseconds;

    const redisKey =
      `rate-limit:reservation:${userId}`;

    const requestId =
      `${now}:${crypto.randomUUID()}`;

    const transaction = redis.multi();

    transaction.zremrangebyscore(
      redisKey,
      0,
      windowStart,
    );

    transaction.zadd(
      redisKey,
      now,
      requestId,
    );

    transaction.zcard(redisKey);

    transaction.pexpire(
      redisKey,
      windowMilliseconds,
    );

    const results = await transaction.exec();

    if (!results) {
      throw new Error(
        "Redis rate-limit transaction failed",
      );
    }

    const requestCountResult = results[2];

    if (!requestCountResult) {
      throw new Error(
        "Redis rate-limit count result is missing",
      );
    }

    const [countError, requestCountValue] =
      requestCountResult;

    if (countError) {
      throw countError;
    }

    const requestCount =
      Number(requestCountValue);

    response.setHeader(
      "RateLimit-Limit",
      env.RESERVATION_RATE_LIMIT_MAX,
    );

    response.setHeader(
      "RateLimit-Remaining",
      Math.max(
        env.RESERVATION_RATE_LIMIT_MAX -
          requestCount,
        0,
      ),
    );

    if (
      requestCount >
      env.RESERVATION_RATE_LIMIT_MAX
    ) {
      response.setHeader(
        "Retry-After",
        env.RESERVATION_RATE_LIMIT_WINDOW_SECONDS,
      );

      response.status(429).json({
        status: "error",
        message:
          "Too many reservation attempts. Please try again later.",
      });

      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export { reservationRateLimit };