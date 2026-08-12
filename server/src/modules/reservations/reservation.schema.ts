import { z } from "zod";

const createReservationSchema = z
  .object({
    seatId: z.uuid(),
  })
  .strict();

const idempotencyKeySchema = z.uuid();

export {
  createReservationSchema,
  idempotencyKeySchema,
};