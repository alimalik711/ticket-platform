import type {
  RequestHandler,
} from "express";

import {
  createPaymentIntentParamsSchema,
} from "./payment.schema.js";

import {
  createOrReusePaymentIntent,
} from "./payment.service.js";

const createPaymentIntent: RequestHandler =
  async (
    request,
    response,
    next,
  ) => {
    try {
      /*
       * Express stores URL parameters inside
       * request.params.
       */
      const parsedParams =
        createPaymentIntentParamsSchema.safeParse(
          request.params,
        );

      if (!parsedParams.success) {
        response.status(400).json({
          status: "error",
          message:
            "reservationId must be a valid UUID",
          issues:
            parsedParams.error.issues,
        });

        return;
      }

      /*
       * Get the validated reservation ID from
       * Zod's parsed data.
       */
      const { reservationId } =
        parsedParams.data;

      /*
       * requireAuth placed the authenticated user
       * inside response.locals.
       */
      const userId =
        response.locals.user.id;

      /*
       * The service validates the reservation,
       * prepares the local payment, and creates or
       * reuses the Stripe PaymentIntent.
       */
      const result =
        await createOrReusePaymentIntent(
          reservationId,
          userId,
        );

      if (
        result.kind ===
        "reservation_not_found"
      ) {
        response.status(404).json({
          status: "error",
          message: "Reservation not found",
        });

        return;
      }

      if (
        result.kind ===
        "reservation_expired"
      ) {
        response.status(409).json({
          status: "error",
          message: "Reservation has expired",
        });

        return;
      }

      if (
        result.kind ===
        "reservation_not_payable"
      ) {
        response.status(409).json({
          status: "error",
          message:
            "Reservation cannot be paid",
          data: {
            reservationStatus:
              result.status,
          },
        });

        return;
      }

      if (
        result.kind ===
        "payment_unavailable"
      ) {
        response.status(409).json({
          status: "error",
          message:
            "Payment is unavailable",
          data: {
            paymentStatus:
              result.status,
          },
        });

        return;
      }

      if (
        result.kind === "already_paid"
      ) {
        response.status(200).json({
          status: "success",
          message:
            "Reservation is already paid",
          data: {
            payment: result.payment,
            alreadyPaid: true,
          },
        });

        return;
      }

      /*
       * TypeScript now knows the remaining result
       * is payment_ready.
       *
       * New PaymentIntent: 201
       * Reused PaymentIntent: 200
       */
      response
        .status(result.reused ? 200 : 201)
        .json({
          status: "success",

          message: result.reused
            ? "Existing payment operation reused"
            : "Payment operation created",

          data: {
            payment: result.payment,

            clientSecret:
              result.clientSecret,

            reused: result.reused,
          },
        });
    } catch (error) {
      /*
       * Unexpected PostgreSQL, Stripe, or server
       * errors go to the global error handler.
       */
      next(error);
    }
  };

export { createPaymentIntent };