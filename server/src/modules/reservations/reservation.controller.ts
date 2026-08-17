import type { RequestHandler } from "express";

import {
  invalidateEventSeatsCache,
} from "../../cache/event-seats.cache.js";

import {
  scheduleReservationExpiration,
} from "../../queues/reservation-expiration.queue.js";

import {
  createReservationSchema,
  idempotencyKeySchema,
} from "./reservation.schema.js";

import {
  createReservation as createReservationInDatabase,
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

export { createReservation };