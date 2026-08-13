import { pool } from "../../db/pool.js";

type ReservationForExpirationRow = {
  seat_id: string;
  status: string;
  is_due: boolean;
};

type ExpirationResult =
  | {
      kind: "expired";
      reservationId: string;
      seatId: string;
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "already_processed";
      status: string;
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
            seat_id,
            status,
            expires_at <= CURRENT_TIMESTAMP AS is_due
          FROM reservations
          WHERE id = $1
          FOR UPDATE
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

    await client.query("COMMIT");

    return {
      kind: "expired",
      reservationId,
      seatId: reservation.seat_id,
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