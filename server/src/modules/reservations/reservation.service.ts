import type { PoolClient } from "pg";

import { pool } from "../../db/pool.js";

type ReservationRow = {
  id: string;
  seat_id: string;
  user_id: string;
  price_cents: number;
  status:
    | "HELD"
    | "CONFIRMED"
    | "EXPIRED"
    | "CANCELLED";
  expires_at: Date;
  confirmed_at: Date | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
};

type SeatForReservationRow = {
  id: string;
  event_id: string;
  price_cents: number;
  status: "AVAILABLE" | "HELD" | "SOLD";
};

type CreateReservationResult =
  | {
      kind: "created";
      reservation: ReservationRow;
      eventId: string;
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

type CancelReservationResult =
  | {
      kind: "cancelled";
      reservationId: string;
      seatId: string;
      eventId: string;
    }
  | {
      kind: "already_cancelled";
      reservationId: string;
      seatId: string;
      eventId: string;
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "not_cancellable";
      status: ReservationRow["status"];
    };

const findReservationByIdempotencyKey = async (
  client: PoolClient,
  userId: string,
  idempotencyKey: string,
): Promise<ReservationRow | undefined> => {
  const result =
    await client.query<ReservationRow>(
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
    (error as { code?: unknown }).code ===
      "23505"
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

      if (
        existingReservation.seat_id !== seatId
      ) {
        return {
          kind: "idempotency_key_reused",
        };
      }

      return {
        kind: "idempotent_replay",
        reservation: existingReservation,
      };
    }

    const seatResult =
      await client.query<SeatForReservationRow>(
        `
          SELECT
            seats.id,
            seats.event_id,
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
        if (
          reservationAfterWaiting.seat_id !==
          seatId
        ) {
          return {
            kind: "idempotency_key_reused",
          };
        }

        return {
          kind: "idempotent_replay",
          reservation:
            reservationAfterWaiting,
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

    const reservationResult =
      await client.query<ReservationRow>(
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

    const reservation =
      reservationResult.rows[0];

    if (!reservation) {
      throw new Error(
        "Reservation insertion unexpectedly returned no row",
      );
    }

    await client.query("COMMIT");

    return {
      kind: "created",
      reservation,
      eventId: seat.event_id,
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
        if (
          existingReservation.seat_id !==
          seatId
        ) {
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

const cancelReservation = async (
  reservationId: string,
  userId: string,
): Promise<CancelReservationResult> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservationResult =
      await client.query<{
        seat_id: string;
        event_id: string;
        status: ReservationRow["status"];
      }>(
        `
          SELECT
            reservations.seat_id,
            seats.event_id,
            reservations.status
          FROM reservations
          INNER JOIN seats
            ON seats.id = reservations.seat_id
          WHERE reservations.id = $1
            AND reservations.user_id = $2
          FOR UPDATE OF reservations, seats
        `,
        [reservationId, userId],
      );

    const reservation = reservationResult.rows[0];

    if (!reservation) {
      await client.query("COMMIT");

      return {
        kind: "not_found",
      };
    }

    if (reservation.status === "CANCELLED") {
      await client.query("COMMIT");

      return {
        kind: "already_cancelled",
        reservationId,
        seatId: reservation.seat_id,
        eventId: reservation.event_id,
      };
    }

    if (reservation.status !== "HELD") {
      await client.query("COMMIT");

      return {
        kind: "not_cancellable",
        status: reservation.status,
      };
    }

    const reservationUpdateResult = await client.query(
      `
        UPDATE reservations
        SET
          status = 'CANCELLED',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND user_id = $2
          AND status = 'HELD'
      `,
      [reservationId, userId],
    );

    const seatUpdateResult = await client.query(
      `
        UPDATE seats
        SET
          status = 'AVAILABLE',
          held_until = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND status = 'HELD'
      `,
      [reservation.seat_id],
    );

    if (
      reservationUpdateResult.rowCount !== 1 ||
      seatUpdateResult.rowCount !== 1
    ) {
      throw new Error(
        "Reservation cancellation did not release exactly one seat",
      );
    }

    await client.query("COMMIT");

    return {
      kind: "cancelled",
      reservationId,
      seatId: reservation.seat_id,
      eventId: reservation.event_id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

type ReservationWithDetails = ReservationRow & {
  seat: {
    section: string;
    row_label: string;
    seat_number: string;
  };
  event: {
    id: string;
    title: string;
    venue_name: string;
    starts_at: Date;
  };
};

const getReservationsByUserId = async (
  userId: string,
): Promise<ReservationWithDetails[]> => {
  const result = await pool.query<any>(
    `
      SELECT
        r.id,
        r.seat_id,
        r.user_id,
        r.price_cents,
        r.status,
        r.expires_at,
        r.confirmed_at,
        r.idempotency_key,
        r.created_at,
        r.updated_at,
        s.section,
        s.row_label,
        s.seat_number,
        e.id AS event_id,
        e.title AS event_title,
        e.venue_name,
        e.starts_at AS event_starts_at
      FROM reservations r
      JOIN seats s ON r.seat_id = s.id
      JOIN events e ON s.event_id = e.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    seat_id: row.seat_id,
    user_id: row.user_id,
    price_cents: row.price_cents,
    status: row.status,
    expires_at: row.expires_at,
    confirmed_at: row.confirmed_at,
    idempotency_key: row.idempotency_key,
    created_at: row.created_at,
    updated_at: row.updated_at,
    seat: {
      section: row.section,
      row_label: row.row_label,
      seat_number: row.seat_number,
    },
    event: {
      id: row.event_id,
      title: row.event_title,
      venue_name: row.venue_name,
      starts_at: row.event_starts_at,
    },
  }));
};

const getReservationByIdAndUserId = async (
  reservationId: string,
  userId: string,
): Promise<ReservationWithDetails | null> => {
  const result = await pool.query<any>(
    `
      SELECT
        r.id,
        r.seat_id,
        r.user_id,
        r.price_cents,
        r.status,
        r.expires_at,
        r.confirmed_at,
        r.idempotency_key,
        r.created_at,
        r.updated_at,
        s.section,
        s.row_label,
        s.seat_number,
        e.id AS event_id,
        e.title AS event_title,
        e.venue_name,
        e.starts_at AS event_starts_at
      FROM reservations r
      JOIN seats s ON r.seat_id = s.id
      JOIN events e ON s.event_id = e.id
      WHERE r.id = $1 AND r.user_id = $2
    `,
    [reservationId, userId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    seat_id: row.seat_id,
    user_id: row.user_id,
    price_cents: row.price_cents,
    status: row.status,
    expires_at: row.expires_at,
    confirmed_at: row.confirmed_at,
    idempotency_key: row.idempotency_key,
    created_at: row.created_at,
    updated_at: row.updated_at,
    seat: {
      section: row.section,
      row_label: row.row_label,
      seat_number: row.seat_number,
    },
    event: {
      id: row.event_id,
      title: row.event_title,
      venue_name: row.venue_name,
      starts_at: row.event_starts_at,
    },
  };
};

export {
  cancelReservation,
  createReservation,
  getReservationsByUserId,
  getReservationByIdAndUserId,
  type ReservationWithDetails,
};
