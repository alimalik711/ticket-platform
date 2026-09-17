import type { RequestHandler } from "express";

import {
  invalidateEventSeatsCache,
} from "../../cache/event-seats.cache.js";

import {
  schedulePaymentRefund,
} from "../../queues/payment-refund.queue.js";

import {
  scheduleReservationExpiration,
} from "../../queues/reservation-expiration.queue.js";

import {
  publishSeatUpdated,
} from "../../realtime/seat-events.js";

import {
  cancelPaymentForExpiredReservation,
} from "../payment/payment.service.js";

import {
  createReservationSchema,
  idempotencyKeySchema,
  reservationIdParamSchema,
} from "./reservation.schema.js";

import {
  cancelReservation as cancelReservationInDatabase,
  createReservation as createReservationInDatabase,
  getReservationsByUserId,
} from "./reservation.service.js";

const createReservation: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const parsedBody =
      createReservationSchema.safeParse(
        request.body,
      );

    if (!parsedBody.success) {
      response.status(400).json({
        status: "error",
        message:
          "Request body must contain only a valid seatId",
        issues: parsedBody.error.issues,
      });

      return;
    }

    const parsedIdempotencyKey =
      idempotencyKeySchema.safeParse(
        request.get("Idempotency-Key"),
      );

    if (!parsedIdempotencyKey.success) {
      response.status(400).json({
        status: "error",
        message:
          "Idempotency-Key header must be a valid UUID",
      });

      return;
    }

    const userId = response.locals.user.id;

    const { seatId } = parsedBody.data;

    const idempotencyKey =
      parsedIdempotencyKey.data;

    const result =
      await createReservationInDatabase(
        seatId,
        userId,
        idempotencyKey,
      );

    if (result.kind === "seat_not_found") {
      response.status(404).json({
        status: "error",
        message:
          "Available published seat not found",
      });

      return;
    }

    if (result.kind === "seat_unavailable") {
      response.status(409).json({
        status: "error",
        message:
          "Seat is no longer available",
      });

      return;
    }

    if (
      result.kind ===
      "idempotency_key_reused"
    ) {
      response.status(409).json({
        status: "error",
        message:
          "Idempotency-Key cannot be reused for a different seat",
      });

      return;
    }

    if (
      result.kind === "idempotent_replay"
    ) {
      await scheduleReservationExpiration(
        result.reservation.id,
        result.reservation.expires_at,
      );

      response.status(200).json({
        status: "success",
        data: {
          reservation:
            result.reservation,
          idempotentReplay: true,
        },
      });

      return;
    }

    await invalidateEventSeatsCache(
      result.eventId,
    );

    await publishSeatUpdated({
      eventId: result.eventId,
      seatId: result.reservation.seat_id,
      status: "HELD",
      heldUntil:
        result.reservation.expires_at.toISOString(),
    });

    await scheduleReservationExpiration(
      result.reservation.id,
      result.reservation.expires_at,
    );

    response.status(201).json({
      status: "success",
      data: {
        reservation: result.reservation,
        idempotentReplay: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getReservations: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const userId = response.locals.user.id;
    const reservations = await getReservationsByUserId(userId);

    response.status(200).json({
      status: "success",
      data: {
        reservations,
      },
    });
  } catch (error) {
    next(error);
  }
};

const cancelReservation: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const parsedReservationId =
      reservationIdParamSchema.safeParse(
        request.params.reservationId,
      );

    if (!parsedReservationId.success) {
      response.status(400).json({
        status: "error",
        message: "reservationId must be a valid UUID",
      });

      return;
    }

    const result =
      await cancelReservationInDatabase(
        parsedReservationId.data,
        response.locals.user.id,
      );

    if (result.kind === "not_found") {
      response.status(404).json({
        status: "error",
        message: "Reservation not found",
      });

      return;
    }

    if (result.kind === "not_cancellable") {
      response.status(409).json({
        status: "error",
        message: "Only held reservations can be cancelled",
        data: {
          reservationStatus: result.status,
        },
      });

      return;
    }

    if (result.kind === "cancelled") {
      await invalidateEventSeatsCache(result.eventId);

      await publishSeatUpdated({
        eventId: result.eventId,
        seatId: result.seatId,
        status: "AVAILABLE",
        heldUntil: null,
      });
    }

    const paymentCancellationResult =
      await cancelPaymentForExpiredReservation(
        result.reservationId,
      );

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

    response.status(200).json({
      status: "success",
      data: {
        reservation: {
          id: result.reservationId,
          status: "CANCELLED",
        },
        alreadyCancelled:
          result.kind === "already_cancelled",
      },
    });
  } catch (error) {
    next(error);
  }
};

export {
  cancelReservation,
  createReservation,
  getReservations,
};
