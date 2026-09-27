import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
} from "vitest";

import request from "supertest";
import { randomUUID } from "crypto";

import { app } from "../app.js";
import { pool } from "../db/pool.js";

const testEventId = "22222222-2222-4222-8222-222222222222";
const testSeatId = "33333333-3333-4333-8333-333333333333";

let user1Cookie: string;
let user2Cookie: string;
let user1Id: string;
let user2Id: string;

const testRunId = randomUUID().slice(0, 8);
const user1Email = `user1-${testRunId}@concurrency-test.com`;
const user2Email = `user2-${testRunId}@concurrency-test.com`;

async function signUpAndSignIn(
  email: string,
  password: string,
  name: string,
): Promise<{ cookie: string; userId: string }> {
  const signUpResponse = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ email, password, name });

  expect(signUpResponse.status).toBe(200);

  const signInResponse = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email, password });

  expect(signInResponse.status).toBe(200);

  const cookie = signInResponse.headers["set-cookie"]?.[0] ?? "";
  const userId = signInResponse.body.data?.user?.id ?? signInResponse.body.user?.id;

  return { cookie, userId };
}

describe("Reservation Concurrency", () => {
  beforeAll(async () => {
    await pool.query("DELETE FROM reservations");
    await pool.query("DELETE FROM seats WHERE event_id = $1", [testEventId]);
    await pool.query("DELETE FROM events WHERE id = $1", [testEventId]);

    await pool.query(
      `
      INSERT INTO events (id, title, description, venue_name, starts_at, status)
      VALUES ($1, 'Concurrency Test Event', 'Test event for concurrency', 'Test Venue', '2026-12-20 19:00:00+05', 'PUBLISHED')
      `,
      [testEventId],
    );

    await pool.query(
      `
      INSERT INTO seats (id, event_id, section, row_label, seat_number, price_cents, status)
      VALUES ($1, $2, 'A', '1', '1', 5000, 'AVAILABLE')
      `,
      [testSeatId, testEventId],
    );

    const user1 = await signUpAndSignIn(
      user1Email,
      "password123",
      "User One",
    );
    user1Cookie = user1.cookie;
    user1Id = user1.userId;

    const user2 = await signUpAndSignIn(
      user2Email,
      "password123",
      "User Two",
    );
    user2Cookie = user2.cookie;
    user2Id = user2.userId;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM reservations WHERE seat_id = $1", [testSeatId]);
    await pool.query("DELETE FROM seats WHERE id = $1", [testSeatId]);
    await pool.query("DELETE FROM events WHERE id = $1", [testEventId]);
    await pool.query("DELETE FROM \"user\" WHERE email IN ($1, $2)", [user1Email, user2Email]);
    await pool.end();
  });

  it("two users simultaneously reserve the same seat - exactly one succeeds", async () => {
    const idempotencyKey1 = randomUUID();
    const idempotencyKey2 = randomUUID();

    const reservationPromise1 = request(app)
      .post("/api/v1/reservations")
      .set("Cookie", user1Cookie)
      .set("Idempotency-Key", idempotencyKey1)
      .send({ seatId: testSeatId });

    const reservationPromise2 = request(app)
      .post("/api/v1/reservations")
      .set("Cookie", user2Cookie)
      .set("Idempotency-Key", idempotencyKey2)
      .send({ seatId: testSeatId });

    const [response1, response2] = await Promise.all([
      reservationPromise1,
      reservationPromise2,
    ]);

    const successCount = [response1, response2].filter((r) => r.status === 201).length;
    const conflictCount = [response1, response2].filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    const successResponse = response1.status === 201 ? response1 : response2;
    const conflictResponse = response1.status === 409 ? response1 : response2;

    expect(successResponse.body.status).toBe("success");
    expect(successResponse.body.data.reservation.status).toBe("HELD");
    expect(successResponse.body.data.reservation.seat_id).toBe(testSeatId);
    expect(successResponse.body.data.idempotentReplay).toBe(false);

    expect(conflictResponse.body.status).toBe("error");
    expect(conflictResponse.body.message).toBe("Seat is no longer available");
  });

  it("database contains exactly one active reservation for the seat", async () => {
    const reservationsResult = await pool.query(
      `
      SELECT id, seat_id, user_id, status
      FROM reservations
      WHERE seat_id = $1 AND status IN ('HELD', 'CONFIRMED')
      `,
      [testSeatId],
    );

    expect(reservationsResult.rows.length).toBe(1);
    expect(reservationsResult.rows[0].status).toBe("HELD");
    expect(reservationsResult.rows[0].seat_id).toBe(testSeatId);
  });

  it("seat ends in HELD state", async () => {
    const seatResult = await pool.query(
      `
      SELECT id, status, held_until
      FROM seats
      WHERE id = $1
      `,
      [testSeatId],
    );

    expect(seatResult.rows.length).toBe(1);
    expect(seatResult.rows[0].status).toBe("HELD");
    expect(seatResult.rows[0].held_until).not.toBeNull();
  });

  it("no duplicate active reservations are created", async () => {
    const allReservationsResult = await pool.query(
      `
      SELECT id, seat_id, status
      FROM reservations
      WHERE seat_id = $1
      `,
      [testSeatId],
    );

    expect(allReservationsResult.rows.length).toBe(1);
    expect(allReservationsResult.rows[0].status).toBe("HELD");
  });
});