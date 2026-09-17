import { z } from "zod";

const createPaymentIntentParamsSchema =
  z
    .object({
      reservationId: z
        .string()
        .uuid(
          "reservationId must be a valid UUID",
        ),
    })
    .strict();

const paymentIdParamsSchema = z
  .object({
    id: z
      .string()
      .uuid("id must be a valid UUID"),
  })
  .strict();

export {
  createPaymentIntentParamsSchema,
  paymentIdParamsSchema,
};
