import type {
  QueryResultRow,
} from "pg";

import {
  getCachedEventSeats,
  setCachedEventSeats,
} from "../../cache/event-seats.cache.js";

import { pool } from "../../db/pool.js";

type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "CANCELLED"
  | "COMPLETED";

interface EventSummary extends QueryResultRow {
  id: string;
  title: string;
  description: string | null;
  venueName: string;
  startsAt: Date;
  status: EventStatus;
}

type SeatStatus =
  | "AVAILABLE"
  | "HELD"
  | "SOLD";

interface SeatSummary extends QueryResultRow {
  id: string;
  section: string;
  rowLabel: string;
  seatNumber: string;
  priceCents: number;
  status: SeatStatus;
  heldUntil: Date | null;
}

/*
 * PostgreSQL returns heldUntil as a Date.
 *
 * Redis stores JSON, so heldUntil becomes an
 * ISO date string after JSON.stringify().
 */
interface CachedSeatSummary {
  id: string;
  section: string;
  rowLabel: string;
  seatNumber: string;
  priceCents: number;
  status: SeatStatus;
  heldUntil: string | null;
}

const listPublishedEvents =
  async (): Promise<EventSummary[]> => {
    const result =
      await pool.query<EventSummary>(
        `
          SELECT
            id,
            title,
            description,
            venue_name AS "venueName",
            starts_at AS "startsAt",
            status
          FROM events
          WHERE status = $1
            AND starts_at > CURRENT_TIMESTAMP
          ORDER BY starts_at ASC
        `,
        ["PUBLISHED"],
      );

    return result.rows;
  };

const getPublishedEventById = async (
  eventId: string,
): Promise<EventSummary | null> => {
  const result =
    await pool.query<EventSummary>(
      `
        SELECT
          id,
          title,
          description,
          venue_name AS "venueName",
          starts_at AS "startsAt",
          status
        FROM events
        WHERE id = $1
          AND status = $2
        LIMIT 1
      `,
      [eventId, "PUBLISHED"],
    );

  return result.rows[0] ?? null;
};

const listSeatsForEvent = async (
  eventId: string,
): Promise<SeatSummary[]> => {
  /*
   * Ask Redis for the cached seat list.
   *
   * The generic tells TypeScript what shape we
   * expect after JSON.parse().
   */
  const cachedSeats =
    await getCachedEventSeats<
      CachedSeatSummary[]
    >(eventId);

  if (cachedSeats !== null) {
    console.log("Event seats cache hit", {
      eventId,
    });

    /*
     * Convert heldUntil from its cached string
     * representation back into a Date.
     */
    return cachedSeats.map(
      (seat): SeatSummary => ({
        id: seat.id,
        section: seat.section,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        priceCents: seat.priceCents,
        status: seat.status,

        heldUntil:
          seat.heldUntil === null
            ? null
            : new Date(seat.heldUntil),
      }),
    );
  }

  console.log("Event seats cache miss", {
    eventId,
  });

  /*
   * Redis did not contain the seat list, so read
   * the source of truth from PostgreSQL.
   */
  const result =
    await pool.query<SeatSummary>(
      `
        SELECT
          id,
          section,
          row_label AS "rowLabel",
          seat_number AS "seatNumber",
          price_cents AS "priceCents",
          status,
          held_until AS "heldUntil"
        FROM seats
        WHERE event_id = $1
        ORDER BY
          section ASC,
          row_label ASC,
          seat_number ASC
      `,
      [eventId],
    );

  /*
   * Store the complete fresh seat list in Redis.
   * Dates become strings when JSON.stringify runs
   * inside setCachedEventSeats().
   */
  await setCachedEventSeats(
    eventId,
    result.rows,
  );

  return result.rows;
};

export {
  listPublishedEvents,
  getPublishedEventById,
  listSeatsForEvent,
};