import {
  Queue,
} from "bullmq";

import { redis } from "../redis/client.js";

type PaymentRefundJobData = {
  paymentId: string;
};

const paymentRefundQueue =
  new Queue<PaymentRefundJobData>(
    "payment-refund",
    {
      connection: redis,
    },
  );

const schedulePaymentRefund = async (
  paymentId: string,
): Promise<void> => {
  await paymentRefundQueue.add(
    "refund-payment",
    {
      paymentId,
    },
    {
      /*
       * Every refund for the same local payment
       * uses the same BullMQ job ID.
       */
      jobId: `refund-${paymentId}`,

      /*
       * Try the refund up to five times when Stripe
       * or the network temporarily fails.
       */
      attempts: 5,

      /*
       * Wait progressively longer after each
       * failure:
       *
       * 5 seconds, 10 seconds, 20 seconds...
       */
      backoff: {
        type: "exponential",
        delay: 5000,
      },

      /*
       * Retain completed jobs temporarily for
       * debugging and duplicate protection.
       */
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },

      /*
       * Keep failed jobs longer so we can inspect
       * why a refund could not be completed.
       */
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
      },
    },
  );
};

export {
  paymentRefundQueue,
  schedulePaymentRefund,
  type PaymentRefundJobData,
};