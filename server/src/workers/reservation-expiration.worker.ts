import {
  Job,
  Worker,
} from "bullmq";

import { redis } from "../redis/client.js";

import {
  type ExpireReservationJobData,
} from "../queues/reservation-expiration.queue.js";

import {
  expireReservation,
  type ExpirationResult,
} from "../modules/reservations/reservation-expiration.service.js";


import { pool } from "../db/pool.js";


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
    // Stop accepting new jobs and wait for active jobs.
    await reservationExpirationWorker.close();

    // Close the worker's Redis connection.
    await workerRedis.quit();

    // Close all PostgreSQL pool connections.
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