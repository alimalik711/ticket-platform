import { Queue } from "bullmq";
import { redis } from "../redis/client.js";

type ExpireReservationJobData = {
  reservationId: string;
};

const reservationExpirationQueue =
  new Queue<ExpireReservationJobData>(
    "reservation-expiration",
    {
      connection: redis,

      defaultJobOptions: {
        attempts: 5,

        backoff: {
          type: "exponential",
          delay: 1000,
        },

        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    },
  );

const scheduleReservationExpiration = async (
  reservationId: string,
  expiresAt: Date,
): Promise<void> => {
  const delay = Math.max(
    expiresAt.getTime() - Date.now(),
    0,
  );

  await reservationExpirationQueue.add(
    "expire-reservation",
    {
      reservationId,
    },
    {
      delay,
      jobId: `expire-${reservationId}`,
    },
  );
};

export {
  reservationExpirationQueue,
  scheduleReservationExpiration,
  type ExpireReservationJobData,
};