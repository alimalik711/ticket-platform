import {
  Worker,
} from "bullmq";

import type {
  Job,
} from "bullmq";

import {
  invalidateEventSeatsCache,
} from "../cache/event-seats.cache.js";

import {
  publishSeatUpdated,
} from "../realtime/seat-events.js";

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

import {
  schedulePaymentRefund,
} from "../queues/payment-refund.queue.js";

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
   * Expire the reservation and release the seat
   * inside one PostgreSQL transaction.
   */
  const expirationResult =
    await expireReservation(
      job.data.reservationId,
    );

  /*
   * Delete the cached seat list only when the
   * database actually changed the seat from
   * HELD to AVAILABLE.
   */
  if (
    expirationResult.kind === "expired"
  ) {
    await invalidateEventSeatsCache(
      expirationResult.eventId,
    );

    /*
     * Notify connected clients that the seat
     * is available again.
     */
    await publishSeatUpdated({
      eventId:
        expirationResult.eventId,
      seatId:
        expirationResult.seatId,
      status: "AVAILABLE",
      heldUntil: null,
    });
  }

  /*
   * Handle the associated payment after the
   * reservation has been confirmed as expired.
   *
   * already_processed + EXPIRED is included so
   * BullMQ retries can repeat payment handling
   * after an earlier Stripe or Redis failure.
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

    /*
     * A successful payment cannot be cancelled.
     * It must be returned through a refund job.
     */
    if (
      paymentCancellationResult.kind ===
        "refund_required" ||
      (
        paymentCancellationResult.kind ===
          "refund_already_in_progress" &&
        paymentCancellationResult.status ===
          "REFUND_PENDING"
      )
    ) {
      await schedulePaymentRefund(
        paymentCancellationResult.paymentId,
      );
    }

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

        attempt:
          job?.attemptsMade,

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
     * Stop accepting new jobs and wait for active
     * jobs to finish.
     */
    await reservationExpirationWorker.close();

    /*
     * Close the BullMQ worker connection.
     */
    await workerRedis.quit();

    /*
     * Close the shared Redis connection used by
     * cache invalidation and refund scheduling.
     */
    await redis.quit();

    /*
     * Close this process's PostgreSQL pool.
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