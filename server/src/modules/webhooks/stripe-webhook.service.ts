import type {
  PoolClient,
  QueryResultRow,
} from "pg";

import { pool } from "../../db/pool.js";

type PaymentStatus =
  | "CREATING"
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED";

interface PaymentForWebhookRow
  extends QueryResultRow {
  payment_id: string;
  payment_status: PaymentStatus;

  reservation_id: string;

  reservation_status:
    | "HELD"
    | "CONFIRMED"
    | "EXPIRED"
    | "CANCELLED";

  reservation_is_expired: boolean;

  seat_id: string;

  seat_status:
    | "AVAILABLE"
    | "HELD"
    | "SOLD";

  amount_cents: number;
  currency: string;
}

type PaymentSucceededResult =
  | {
      kind: "processed";
      paymentId: string;
      reservationId: string;
      seatId: string;
    }
  | {
      kind: "duplicate_event";
    }
  | {
      kind: "already_succeeded";
      paymentId: string;
    }
  | {
      kind: "late_payment";
      paymentId: string;
    };

type PaymentFailedResult =
  | {
      kind: "processed";
      paymentId: string;
    }
  | {
      kind: "duplicate_event";
    }
  | {
      kind: "success_already_final";
      paymentId: string;
    }
  | {
      kind: "terminal_payment";
      paymentId: string;
      status: PaymentStatus;
    };

const recordStripeEvent = async (
  client: PoolClient,
  stripeEventId: string,
  eventType: string,
  stripePaymentIntentId: string,
): Promise<boolean> => {
  const result = await client.query<{
    stripe_event_id: string;
  }>(
    `
      INSERT INTO stripe_webhook_events (
        stripe_event_id,
        event_type,
        stripe_payment_intent_id
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (stripe_event_id)
      DO NOTHING
      RETURNING stripe_event_id
    `,
    [
      stripeEventId,
      eventType,
      stripePaymentIntentId,
    ],
  );

  return result.rows.length === 1;
};

const findAndLockPayment = async (
  client: PoolClient,
  stripePaymentIntentId: string,
): Promise<
  PaymentForWebhookRow | undefined
> => {
  const result =
    await client.query<PaymentForWebhookRow>(
      `
        SELECT
          payments.id
            AS payment_id,

          payments.status
            AS payment_status,

          payments.reservation_id,

          reservations.status
            AS reservation_status,

          reservations.expires_at
            <= CURRENT_TIMESTAMP
            AS reservation_is_expired,

          reservations.seat_id,

          seats.status
            AS seat_status,

          payments.amount_cents,
          payments.currency

        FROM payments

        INNER JOIN reservations
          ON reservations.id =
            payments.reservation_id

        INNER JOIN seats
          ON seats.id =
            reservations.seat_id

        WHERE
          payments.stripe_payment_intent_id =
            $1

        FOR UPDATE OF
          payments,
          reservations,
          seats
      `,
      [stripePaymentIntentId],
    );

  return result.rows[0];
};

const processPaymentSucceeded = async (
  stripeEventId: string,
  eventType: string,
  stripePaymentIntentId: string,
  amountReceived: number,
  currency: string,
): Promise<PaymentSucceededResult> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const isNewEvent =
      await recordStripeEvent(
        client,
        stripeEventId,
        eventType,
        stripePaymentIntentId,
      );

    if (!isNewEvent) {
      await client.query("COMMIT");

      return {
        kind: "duplicate_event",
      };
    }

    const payment =
      await findAndLockPayment(
        client,
        stripePaymentIntentId,
      );

    if (!payment) {
      throw new Error(
        "Stripe webhook references an unknown PaymentIntent",
      );
    }

    const amountMatches =
      payment.amount_cents ===
      amountReceived;

    const currencyMatches =
      payment.currency.toLowerCase() ===
      currency.toLowerCase();

    if (
      !amountMatches ||
      !currencyMatches
    ) {
      throw new Error(
        "Stripe payment amount or currency does not match local payment",
      );
    }

    if (
      payment.payment_status ===
      "SUCCEEDED"
    ) {
      await client.query("COMMIT");

      return {
        kind: "already_succeeded",
        paymentId: payment.payment_id,
      };
    }

    const reservationIsInvalid =
      payment.reservation_status !==
        "HELD" ||
      payment.reservation_is_expired;

    const seatIsInvalid =
      payment.seat_status !== "HELD";

    if (
      reservationIsInvalid ||
      seatIsInvalid
    ) {
      await client.query(
        `
          UPDATE payments
          SET
            status = 'REFUND_PENDING',

            paid_at = COALESCE(
              paid_at,
              CURRENT_TIMESTAMP
            ),

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
        `,
        [payment.payment_id],
      );

      await client.query("COMMIT");

      return {
        kind: "late_payment",
        paymentId: payment.payment_id,
      };
    }

    await client.query(
      `
        UPDATE payments
        SET
          status = 'SUCCEEDED',
          failure_code = NULL,
          failure_message = NULL,

          paid_at = COALESCE(
            paid_at,
            CURRENT_TIMESTAMP
          ),

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
      `,
      [payment.payment_id],
    );

    await client.query(
      `
        UPDATE reservations
        SET
          status = 'CONFIRMED',

          confirmed_at = COALESCE(
            confirmed_at,
            CURRENT_TIMESTAMP
          ),

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
          AND status = 'HELD'
      `,
      [payment.reservation_id],
    );

    await client.query(
      `
        UPDATE seats
        SET
          status = 'SOLD',
          held_until = NULL,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
          AND status = 'HELD'
      `,
      [payment.seat_id],
    );

    await client.query("COMMIT");

    return {
      kind: "processed",
      paymentId: payment.payment_id,
      reservationId:
        payment.reservation_id,
      seatId: payment.seat_id,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

const processPaymentFailed = async (
  stripeEventId: string,
  eventType: string,
  stripePaymentIntentId: string,
  failureCode: string | null,
  failureMessage: string | null,
): Promise<PaymentFailedResult> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const isNewEvent =
      await recordStripeEvent(
        client,
        stripeEventId,
        eventType,
        stripePaymentIntentId,
      );

    if (!isNewEvent) {
      await client.query("COMMIT");

      return {
        kind: "duplicate_event",
      };
    }

    const payment =
      await findAndLockPayment(
        client,
        stripePaymentIntentId,
      );

    if (!payment) {
      throw new Error(
        "Stripe payment failure references an unknown PaymentIntent",
      );
    }

    /*
     * Webhooks may arrive out of order. Never
     * downgrade a successful payment to FAILED.
     */
    if (
      payment.payment_status ===
      "SUCCEEDED"
    ) {
      await client.query("COMMIT");

      return {
        kind: "success_already_final",
        paymentId: payment.payment_id,
      };
    }

    /*
     * These payment states should not return to
     * FAILED through the normal payment flow.
     */
    if (
      payment.payment_status ===
        "CANCELLED" ||
      payment.payment_status ===
        "REFUND_PENDING" ||
      payment.payment_status ===
        "REFUNDED"
    ) {
      await client.query("COMMIT");

      return {
        kind: "terminal_payment",
        paymentId: payment.payment_id,
        status: payment.payment_status,
      };
    }

    await client.query(
      `
        UPDATE payments
        SET
          status = 'FAILED',
          failure_code = $2,
          failure_message = $3,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
      `,
      [
        payment.payment_id,
        failureCode,
        failureMessage,
      ],
    );

    await client.query("COMMIT");

    return {
      kind: "processed",
      paymentId: payment.payment_id,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

export {
  processPaymentFailed,
  processPaymentSucceeded,
  type PaymentFailedResult,
  type PaymentSucceededResult,
};