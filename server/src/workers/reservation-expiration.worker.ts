import {
  Worker,
} from "bullmq";

import type {
  Job,
} from "bullmq";

import {
  invalidateEventSeatsCache,
} from "../cache/event-seats.cache.js";

import { pool } from "../db/pool.js";

import {
  cancelPaymentForExpiredReservation,
} from "../modules/payment/payment.service.js";

import {
  expireReservation,
  type ExpirationResult,
} from "../modules/reservations/reservation-expiration.service.js";

import {
  type ExpireReservationJobData,
} from "../queues/reservation-expiration.queue.js";

import { redis } from "../redis/client.js";

const workerRedis = redis.duplicate({
  maxRetriesPerRequest: null,
});

const processExpirationJob = async (
  job: Job<ExpireReservationJobData>,
): Promise<ExpirationResult> => {
  console.log("Processing expiration job", {
    jobId: job.id,
    reservationId:
      job.data.reservationId,
    attempt: job.attemptsMade + 1,
  });

  /*
   * First expire the reservation and release its
   * seat using a PostgreSQL transaction.
   */
  const expirationResult =
    await expireReservation(
      job.data.reservationId,
    );

  /*
   * Invalidate the cached seat list only when
   * PostgreSQL actually changed the seat from
   * HELD to AVAILABLE.
   */
  if (
    expirationResult.kind === "expired"
  ) {
    await invalidateEventSeatsCache(
      expirationResult.eventId,
    );
  }

  /*
   * Handle the payment after the reservation is
   * confirmed to be expired.
   *
   * We also run this for an already-expired
   * reservation because BullMQ may be retrying
   * after Stripe cancellation previously failed.
   */
  if (
    expirationResult.kind === "expired" ||
    (
      expirationResult.kind ===
        "already_processed" &&
      expirationResult.status ===
        "EXPIRED"
    )
  ) {
    const paymentCancellationResult =
      await cancelPaymentForExpiredReservation(
        job.data.reservationId,
      );

    console.log(
      "Expired reservation payment handled",
      {
        reservationId:
          job.data.reservationId,
        result:
          paymentCancellationResult,
      },
    );
  }

  console.log("Expiration job processed", {
    jobId: job.id,
    reservationId:
      job.data.reservationId,
    result: expirationResult,
  });

  return expirationResult;
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
    console.log(
      "Expiration job completed",
      {
        jobId: job.id,
        result,
      },
    );
  },
);

reservationExpirationWorker.on(
  "failed",
  (job, error) => {
    console.error(
      "Expiration job failed",
      {
        jobId: job?.id,
        reservationId:
          job?.data.reservationId,
        attempt: job?.attemptsMade,
        error: error.message,
      },
    );
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
     * Close the dedicated BullMQ connection.
     */
    await workerRedis.quit();

    /*
     * Close the shared Redis connection used for
     * cache invalidation.
     */
    await redis.quit();

    /*
     * Close every PostgreSQL pool connection.
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