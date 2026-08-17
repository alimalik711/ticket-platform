import { env } from "../config/env.js";
import { redis } from "../redis/client.js";

const getEventSeatsCacheKey = (
  eventId: string,
): string => {
  return `cache:event:${eventId}:seats`;
};

const getCachedEventSeats = async <T>(
  eventId: string,
): Promise<T | null> => {
  const cacheKey =
    getEventSeatsCacheKey(eventId);

  try {
    const cachedValue =
      await redis.get(cacheKey);

    if (cachedValue === null) {
      return null;
    }

    return JSON.parse(cachedValue) as T;
  } catch (error) {
    console.error(
      "Failed to read event seats from cache",
      {
        eventId,
        error,
      },
    );

    return null;
  }
};

const setCachedEventSeats = async (
  eventId: string,
  seats: unknown,
): Promise<void> => {
  const cacheKey =
    getEventSeatsCacheKey(eventId);

  try {
    await redis.set(
      cacheKey,
      JSON.stringify(seats),
      "EX",
      env.EVENT_SEATS_CACHE_TTL_SECONDS,
    );
  } catch (error) {
    console.error(
      "Failed to cache event seats",
      {
        eventId,
        error,
      },
    );
  }
};

const invalidateEventSeatsCache = async (
  eventId: string,
): Promise<void> => {
  const cacheKey =
    getEventSeatsCacheKey(eventId);

  try {
    await redis.del(cacheKey);
  } catch (error) {
    console.error(
      "Failed to invalidate event seats cache",
      {
        eventId,
        error,
      },
    );
  }
};

export {
  getCachedEventSeats,
  setCachedEventSeats,
  invalidateEventSeatsCache,
};