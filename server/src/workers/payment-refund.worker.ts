import {
  Worker,
} from "bullmq";

import type {
  Job,
} from "bullmq";

import { pool } from "../db/pool.js";
import { redis } from "../redis/client.js";

import type {
  PaymentRefundJobData,
} from "../queues/payment-refund.queue.js";

import {
  processPaymentRefund,
  type ProcessPaymentRefundResult,
} from "../modules/payment/payment-refund.service.js";

/*
 * Create a separate Redis connection for this
 * BullMQ worker.
 */
const workerRedis = redis.duplicate({
  maxRetriesPerRequest: null,
});

/*
 * This function runs whenever BullMQ gives the
 * worker one refund job.
 */
const processRefundJob = async (
  job: Job<PaymentRefundJobData>,
): Promise<ProcessPaymentRefundResult> => {
  console.log("Processing payment refund job", {
    jobId: job.id,
    paymentId: job.data.paymentId,
    attempt: job.attemptsMade + 1,
  });

  const result = await processPaymentRefund(
    job.data.paymentId,
  );

  console.log("Payment refund job processed", {
    jobId: job.id,
    paymentId: job.data.paymentId,
    result,
  });

  return result;
};

/*
 * Listen to the same queue name used by
 * payment-refund.queue.ts.
 */
const paymentRefundWorker =
  new Worker<
    PaymentRefundJobData,
    ProcessPaymentRefundResult
  >(
    "payment-refund",
    processRefundJob,
    {
      connection: workerRedis,
      concurrency: 5,
    },
  );

paymentRefundWorker.on(
  "completed",
  (job, result) => {
    console.log("Payment refund job completed", {
      jobId: job.id,
      result,
    });
  },
);

paymentRefundWorker.on(
  "failed",
  (job, error) => {
    console.error("Payment refund job failed", {
      jobId: job?.id,
      paymentId: job?.data.paymentId,
      attemptsMade: job?.attemptsMade,
      error: error.message,
    });
  },
);

paymentRefundWorker.on(
  "error",
  (error) => {
    console.error(
      "Payment refund worker error",
      error,
    );
  },
);

console.log(
  "Payment refund worker is running",
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
    `Received ${signal}. Shutting down refund worker...`,
  );

  try {
    /*
     * Stop accepting new jobs and wait for active
     * refund jobs to finish.
     */
    await paymentRefundWorker.close();

    /*
     * Close this worker's BullMQ Redis connection.
     */
    await workerRedis.quit();

    /*
     * Close the shared Redis connection created
     * when redis/client.ts was imported.
     */
    await redis.quit();

    /*
     * Close this process's PostgreSQL pool.
     */
    await pool.end();

    console.log(
      "Payment refund worker stopped successfully",
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Failed to shut down refund worker cleanly",
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