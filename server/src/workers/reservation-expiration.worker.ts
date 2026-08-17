import {
  Worker,
} from "bullmq";

import type {
  Job,
} from "bullmq";

import { pool } from "../db/pool.js";

import {
  invalidateEventSeatsCache,
} from "../cache/event-seats.cache.js";

import {
  type ExpireReservationJobData,
} from "../queues/reservation-expiration.queue.js";

import { redis } from "../redis/client.js";

import {
  expireReservation,
  type ExpirationResult,
} from "../modules/reservations/reservation-expiration.service.js";

const workerRedis = redis.duplicate({
  maxRetriesPerRequest: null,
});

const processExpirationJob = async (
  job: Job<ExpireReservationJobData>,
): Promise<ExpirationResult> => {
  console.log("Processing expiration job", {
    jobId: job.id,
    reservationId: job.data.reservationId,
    attempt: job.attemptsMade + 1,
  });

  const result = await expireReservation(
    job.data.reservationId,
  );

  /*
   * Only invalidate the cache when PostgreSQL
   * actually changed the seat from HELD to AVAILABLE.
   */
  if (result.kind === "expired") {
    await invalidateEventSeatsCache(
      result.eventId,
    );
  }

  console.log("Expiration job processed", {
    jobId: job.id,
    reservationId: job.data.reservationId,
    result,
  });

  return result;
};

const reservationExpirationWorker =
  new Worker<
    ExpireReservationJobData,
    ExpirationResult
  >(
    "reservation-expiration",
    processExpirationJob,
    {
      connection: workerRedis,
      concurrency: 10,
    },
  );

reservationExpirationWorker.on(
  "completed",
  (job, result) => {
    console.log("Expiration job completed", {
      jobId: job.id,
      result,
    });
  },
);

reservationExpirationWorker.on(
  "failed",
  (job, error) => {
    console.error("Expiration job failed", {
      jobId: job?.id,
      reservationId:
        job?.data.reservationId,
      attempt: job?.attemptsMade,
      error: error.message,
    });
  },
);

reservationExpirationWorker.on(
  "error",
  (error) => {
    console.error(
      "Reservation expiration worker error",
      error,
    );
  },
);

console.log(
  "Reservation expiration worker is running",
);

let isShuttingDown = false;

const shutdown = async (
  signal: string,
): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `Received ${signal}. Shutting down worker...`,
  );

  try {
    /*
     * Stop accepting jobs and wait for currently
     * executing jobs to finish.
     */
    await reservationExpirationWorker.close();

    /*
     * Close the dedicated BullMQ Redis connection.
     */
    await workerRedis.quit();

    /*
     * invalidateEventSeatsCache uses the shared Redis
     * client, so close that connection as well.
     */
    await redis.quit();

    /*
     * Close every PostgreSQL connection in the pool.
     */
    await pool.end();

    console.log(
      "Reservation expiration worker stopped successfully",
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Failed to shut down worker cleanly",
      error,
    );

    process.exit(1);
  }
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});