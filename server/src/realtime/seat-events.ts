import { z } from "zod";

import { redis } from "../redis/client.js";

const SEAT_UPDATES_CHANNEL =
  "realtime:seat-updates";

const seatUpdatedEventSchema = z.object({
  eventId: z.string().uuid(),
  seatId: z.string().uuid(),

  status: z.enum([
    "AVAILABLE",
    "HELD",
    "SOLD",
  ]),

  heldUntil: z
    .string()
    .datetime()
    .nullable(),
});

type SeatUpdatedEvent = z.infer<
  typeof seatUpdatedEventSchema
>;

const publishSeatUpdated = async (
  event: SeatUpdatedEvent,
): Promise<void> => {
  const validatedEvent =
    seatUpdatedEventSchema.parse(event);

  await redis.publish(
    SEAT_UPDATES_CHANNEL,
    JSON.stringify(validatedEvent),
  );
};

export {
  publishSeatUpdated,
  SEAT_UPDATES_CHANNEL,
  seatUpdatedEventSchema,
  type SeatUpdatedEvent,
};