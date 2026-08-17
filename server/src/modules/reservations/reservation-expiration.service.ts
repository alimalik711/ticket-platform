import { pool } from "../../db/pool.js";

type ReservationStatus =
  | "HELD"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED";

type ReservationForExpirationRow = {
  seat_id: string;
  event_id: string;
  status: ReservationStatus;
  is_due: boolean;
};

type ExpirationResult =
  | {
      kind: "expired";
      reservationId: string;
      seatId: string;
      eventId: string;
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "already_processed";
      status: ReservationStatus;
    }
  | {
      kind: "not_due";
    };

const expireReservation = async (
  reservationId: string,
): Promise<ExpirationResult> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservationResult =
      await client.query<ReservationForExpirationRow>(
        `
          SELECT
            reservations.seat_id,
            seats.event_id,
            reservations.status,
            reservations.expires_at
              <= CURRENT_TIMESTAMP AS is_due
          FROM reservations
          INNER JOIN seats
            ON seats.id = reservations.seat_id
          WHERE reservations.id = $1
          FOR UPDATE OF reservations
        `,
        [reservationId],
      );

    const reservation =
      reservationResult.rows[0];

    if (!reservation) {
      await client.query("COMMIT");

      return {
        kind: "not_found",
      };
    }

    if (reservation.status !== "HELD") {
      await client.query("COMMIT");

      return {
        kind: "already_processed",
        status: reservation.status,
      };
    }

    if (!reservation.is_due) {
      await client.query("COMMIT");

      return {
        kind: "not_due",
      };
    }

    const reservationUpdateResult =
      await client.query(
        `
          UPDATE reservations
          SET
            status = 'EXPIRED',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status = 'HELD'
            AND expires_at <= CURRENT_TIMESTAMP
        `,
        [reservationId],
      );

    if (reservationUpdateResult.rowCount !== 1) {
      throw new Error(
        "Expected exactly one reservation to expire",
      );
    }

    const seatUpdateResult =
      await client.query(
        `
          UPDATE seats
          SET
            status = 'AVAILABLE',
            held_until = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status = 'HELD'
            AND held_until <= CURRENT_TIMESTAMP
        `,
        [reservation.seat_id],
      );

    if (seatUpdateResult.rowCount !== 1) {
      throw new Error(
        "Expected exactly one held seat to be released",
      );
    }

    await client.query("COMMIT");

    return {
      kind: "expired",
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

export {
  expireReservation,
  type ExpirationResult,
};