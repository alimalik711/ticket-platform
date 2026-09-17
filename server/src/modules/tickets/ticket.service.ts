import type {
  QueryResultRow,
} from "pg";

import { pool } from "../../db/pool.js";

type TicketRow = QueryResultRow & {
  reservation_id: string;
  confirmed_at: Date;

  event_id: string;
  event_title: string;
  event_description: string | null;
  venue_name: string;
  starts_at: Date;
  event_status:
    | "DRAFT"
    | "PUBLISHED"
    | "CANCELLED"
    | "COMPLETED";

  seat_id: string;
  section: string;
  row_label: string;
  seat_number: string;

  payment_id: string;
  amount_cents: number;
  currency: string;
  paid_at: Date;
};

type Ticket = {
  id: string;
  reservationId: string;
  issuedAt: Date;
  event: {
    id: string;
    title: string;
    description: string | null;
    venueName: string;
    startsAt: Date;
    status:
      | "DRAFT"
      | "PUBLISHED"
      | "CANCELLED"
      | "COMPLETED";
  };
  seat: {
    id: string;
    section: string;
    rowLabel: string;
    seatNumber: string;
  };
  payment: {
    id: string;
    amountCents: number;
    currency: string;
    status: "SUCCEEDED";
    paidAt: Date;
  };
};

const getTicketsByUserId = async (
  userId: string,
): Promise<Ticket[]> => {
  const result = await pool.query<TicketRow>(
    `
      SELECT
        reservations.id AS reservation_id,
        reservations.confirmed_at,
        events.id AS event_id,
        events.title AS event_title,
        events.description AS event_description,
        events.venue_name,
        events.starts_at,
        events.status AS event_status,
        seats.id AS seat_id,
        seats.section,
        seats.row_label,
        seats.seat_number,
        payments.id AS payment_id,
        payments.amount_cents,
        payments.currency,
        payments.paid_at
      FROM reservations
      INNER JOIN payments
        ON payments.reservation_id = reservations.id
      INNER JOIN seats
        ON seats.id = reservations.seat_id
      INNER JOIN events
        ON events.id = seats.event_id
      WHERE reservations.user_id = $1
        AND reservations.status = 'CONFIRMED'
        AND payments.status = 'SUCCEEDED'
      ORDER BY events.starts_at ASC, reservations.confirmed_at DESC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.reservation_id,
    reservationId: row.reservation_id,
    issuedAt: row.confirmed_at,
    event: {
      id: row.event_id,
      title: row.event_title,
      description: row.event_description,
      venueName: row.venue_name,
      startsAt: row.starts_at,
      status: row.event_status,
    },
    seat: {
      id: row.seat_id,
      section: row.section,
      rowLabel: row.row_label,
      seatNumber: row.seat_number,
    },
    payment: {
      id: row.payment_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: "SUCCEEDED",
      paidAt: row.paid_at,
    },
  }));
};

export {
  getTicketsByUserId,
  type Ticket,
};
