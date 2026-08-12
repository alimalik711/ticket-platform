import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";

type ReservationRow = {
  id: string;
  seat_id: string;
  user_id: string;
  price_cents: number;
  status: "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  expires_at: Date;
  confirmed_at: Date | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
};

type CreateReservationResult =
  | {
      kind: "created";
      reservation: ReservationRow;
    }
  | {
      kind: "idempotent_replay";
      reservation: ReservationRow;
    }
  | {
      kind: "idempotency_key_reused";
    }
  | {
      kind: "seat_not_found";
    }
  | {
      kind: "seat_unavailable";
    };

const findReservationByIdempotencyKey = async (
  client: PoolClient,
  userId: string,
  idempotencyKey: string,
): Promise<ReservationRow | undefined> => {
  const result = await client.query<ReservationRow>(
    `
      SELECT
        id,
        seat_id,
        user_id,
        price_cents,
        status,
        expires_at,
        confirmed_at,
        idempotency_key,
        created_at,
        updated_at
      FROM reservations
      WHERE user_id = $1
        AND idempotency_key = $2
    `,
    [userId, idempotencyKey],
  );

  return result.rows[0];
};

const isUniqueViolation = (
  error: unknown,
): error is { code: string } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
};

const createReservation = async (
  seatId: string,
  userId: string,
  idempotencyKey: string,
): Promise<CreateReservationResult> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingReservation =
      await findReservationByIdempotencyKey(
        client,
        userId,
        idempotencyKey,
      );

    if (existingReservation) {
      await client.query("ROLLBACK");

      if (existingReservation.seat_id !== seatId) {
        return {
          kind: "idempotency_key_reused",
        };
      }

      return {
        kind: "idempotent_replay",
        reservation: existingReservation,
      };
    }

    const seatResult = await client.query<{
      id: string;
      price_cents: number;
      status: "AVAILABLE" | "HELD" | "SOLD";
    }>(
      `
        SELECT
          seats.id,
          seats.price_cents,
          seats.status
        FROM seats
        INNER JOIN events
          ON events.id = seats.event_id
        WHERE seats.id = $1
          AND events.status = 'PUBLISHED'
        FOR UPDATE OF seats
      `,
      [seatId],
    );

    const seat = seatResult.rows[0];

    if (!seat) {
      await client.query("ROLLBACK");

      return {
        kind: "seat_not_found",
      };
    }

    if (seat.status !== "AVAILABLE") {
      const reservationAfterWaiting =
        await findReservationByIdempotencyKey(
          client,
          userId,
          idempotencyKey,
        );

      await client.query("ROLLBACK");

      if (reservationAfterWaiting) {
        if (reservationAfterWaiting.seat_id !== seatId) {
          return {
            kind: "idempotency_key_reused",
          };
        }

        return {
          kind: "idempotent_replay",
          reservation: reservationAfterWaiting,
        };
      }

      return {
        kind: "seat_unavailable",
      };
    }

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000,
    );

    await client.query(
      `
        UPDATE seats
        SET
          status = 'HELD',
          held_until = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [seatId, expiresAt],
    );

    const reservationResult = await client.query<ReservationRow>(
      `
        INSERT INTO reservations (
          seat_id,
          user_id,
          price_cents,
          expires_at,
          idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          seat_id,
          user_id,
          price_cents,
          status,
          expires_at,
          confirmed_at,
          idempotency_key,
          created_at,
          updated_at
      `,
      [
        seatId,
        userId,
        seat.price_cents,
        expiresAt,
        idempotencyKey,
      ],
    );

    const reservation = reservationResult.rows[0];

    if (!reservation) {
      throw new Error(
        "Reservation insertion unexpectedly returned no row",
      );
    }

    await client.query("COMMIT");

    return {
      kind: "created",
      reservation,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (isUniqueViolation(error)) {
      const existingReservation =
        await findReservationByIdempotencyKey(
          client,
          userId,
          idempotencyKey,
        );

      if (existingReservation) {
        if (existingReservation.seat_id !== seatId) {
          return {
            kind: "idempotency_key_reused",
          };
        }

        return {
          kind: "idempotent_replay",
          reservation: existingReservation,
        };
      }
    }

    throw error;
  } finally {
    client.release();
  }
};

export { createReservation };