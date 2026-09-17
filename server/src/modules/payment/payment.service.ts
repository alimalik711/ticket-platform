import type {
  QueryResultRow,
} from "pg";

import { pool } from "../../db/pool.js";
import { stripe } from "../../stripe/client.js";

type ReservationStatus =
  | "HELD"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED";

type PaymentStatus =
  | "CREATING"
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED";

interface ReservationForPaymentRow
  extends QueryResultRow {
  id: string;
  user_id: string;
  price_cents: number;
  status: ReservationStatus;
  is_expired: boolean;
}

interface PaymentRow extends QueryResultRow {
  id: string;
  reservation_id: string;

  stripe_payment_intent_id:
    | string
    | null;

  amount_cents: number;
  currency: string;
  status: PaymentStatus;

  failure_code: string | null;
  failure_message: string | null;

  paid_at: Date | null;
  refunded_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

type PreparePaymentResult =
  | {
      kind: "ready";
      payment: PaymentRow;
      created: boolean;
    }
  | {
      kind: "reservation_not_found";
    }
  | {
      kind: "reservation_not_payable";
      status: ReservationStatus;
    }
  | {
      kind: "reservation_expired";
    };

type CreatePaymentIntentResult =
  | {
      kind: "payment_ready";
      payment: PaymentRow;
      clientSecret: string;
      reused: boolean;
    }
  | {
      kind: "already_paid";
      payment: PaymentRow;
    }
  | {
      kind: "payment_unavailable";
      status: PaymentStatus;
    }
  | {
      kind: "reservation_not_found";
    }
  | {
      kind: "reservation_not_payable";
      status: ReservationStatus;
    }
  | {
      kind: "reservation_expired";
    };

type CancelExpiredPaymentResult =
  | {
      kind: "no_payment";
    }
  | {
      kind: "cancelled";
      paymentId: string;
      stripePaymentIntentId:
        | string
        | null;
    }
  | {
      kind: "already_cancelled";
      paymentId: string;
    }
  | {
      kind: "refund_required";
      paymentId: string;
    }
  | {
      kind: "refund_already_in_progress";
      paymentId: string;
      status:
        | "REFUND_PENDING"
        | "REFUNDED";
    };

const preparePaymentForReservation =
  async (
    reservationId: string,
    userId: string,
  ): Promise<PreparePaymentResult> => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /*
       * Find and lock the reservation.
       *
       * Including user_id in WHERE prevents a user
       * from paying for someone else's reservation.
       */
      const reservationResult =
        await client.query<
          ReservationForPaymentRow
        >(
          `
            SELECT
              id,
              user_id,
              price_cents,
              status,
              expires_at
                <= CURRENT_TIMESTAMP
                AS is_expired
            FROM reservations
            WHERE id = $1
              AND user_id = $2
            FOR UPDATE
          `,
          [reservationId, userId],
        );

      const reservation =
        reservationResult.rows[0];

      if (!reservation) {
        await client.query("ROLLBACK");

        return {
          kind: "reservation_not_found",
        };
      }

      /*
       * Only HELD reservations can begin payment.
       */
      if (reservation.status !== "HELD") {
        await client.query("ROLLBACK");

        return {
          kind: "reservation_not_payable",
          status: reservation.status,
        };
      }

      /*
       * The worker may not have changed the status
       * yet, but the actual expiration time has
       * already passed.
       */
      if (reservation.is_expired) {
        await client.query("ROLLBACK");

        return {
          kind: "reservation_expired",
        };
      }

      /*
       * Check whether this reservation already has
       * a payment row.
       */
      const existingPaymentResult =
        await client.query<PaymentRow>(
          `
            SELECT
              id,
              reservation_id,
              stripe_payment_intent_id,
              amount_cents,
              currency,
              status,
              failure_code,
              failure_message,
              paid_at,
              refunded_at,
              created_at,
              updated_at
            FROM payments
            WHERE reservation_id = $1
          `,
          [reservationId],
        );

      const existingPayment =
        existingPaymentResult.rows[0];

      if (existingPayment) {
        await client.query("COMMIT");

        return {
          kind: "ready",
          payment: existingPayment,
          created: false,
        };
      }

      /*
       * No payment exists, so create our local
       * payment before contacting Stripe.
       *
       * The price comes from PostgreSQL rather than
       * the frontend.
       */
      const paymentResult =
        await client.query<PaymentRow>(
          `
            INSERT INTO payments (
              reservation_id,
              amount_cents,
              currency,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              'CREATING'
            )
            RETURNING
              id,
              reservation_id,
              stripe_payment_intent_id,
              amount_cents,
              currency,
              status,
              failure_code,
              failure_message,
              paid_at,
              refunded_at,
              created_at,
              updated_at
          `,
          [
            reservation.id,
            reservation.price_cents,
            "USD",
          ],
        );

      const payment =
        paymentResult.rows[0];

      if (!payment) {
        throw new Error(
          "Payment insertion returned no row",
        );
      }

      await client.query("COMMIT");

      return {
        kind: "ready",
        payment,
        created: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

const findPaymentById = async (
  paymentId: string,
): Promise<PaymentRow | undefined> => {
  const result =
    await pool.query<PaymentRow>(
      `
        SELECT
          id,
          reservation_id,
          stripe_payment_intent_id,
          amount_cents,
          currency,
          status,
          failure_code,
          failure_message,
          paid_at,
          refunded_at,
          created_at,
          updated_at
        FROM payments
        WHERE id = $1
      `,
      [paymentId],
    );

  return result.rows[0];
};

const getPaymentByIdForUser = async (
  paymentId: string,
  userId: string,
): Promise<PaymentRow | undefined> => {
  const result = await pool.query<PaymentRow>(
    `
      SELECT
        payments.id,
        payments.reservation_id,
        payments.stripe_payment_intent_id,
        payments.amount_cents,
        payments.currency,
        payments.status,
        payments.failure_code,
        payments.failure_message,
        payments.paid_at,
        payments.refunded_at,
        payments.created_at,
        payments.updated_at
      FROM payments
      INNER JOIN reservations
        ON reservations.id = payments.reservation_id
      WHERE payments.id = $1
        AND reservations.user_id = $2
    `,
    [paymentId, userId],
  );

  return result.rows[0];
};

const findPaymentByReservationId = async (
  reservationId: string,
): Promise<PaymentRow | undefined> => {
  const result =
    await pool.query<PaymentRow>(
      `
        SELECT
          id,
          reservation_id,
          stripe_payment_intent_id,
          amount_cents,
          currency,
          status,
          failure_code,
          failure_message,
          paid_at,
          refunded_at,
          created_at,
          updated_at
        FROM payments
        WHERE reservation_id = $1
      `,
      [reservationId],
    );

  return result.rows[0];
};

const saveStripePaymentIntent = async (
  paymentId: string,
  stripePaymentIntentId: string,
): Promise<PaymentRow> => {
  /*
   * Only attach a Stripe PaymentIntent while the
   * column is still NULL.
   */
  const result =
    await pool.query<PaymentRow>(
      `
        UPDATE payments
        SET
          stripe_payment_intent_id = $2,
          status = 'PENDING',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND stripe_payment_intent_id IS NULL
        RETURNING
          id,
          reservation_id,
          stripe_payment_intent_id,
          amount_cents,
          currency,
          status,
          failure_code,
          failure_message,
          paid_at,
          refunded_at,
          created_at,
          updated_at
      `,
      [
        paymentId,
        stripePaymentIntentId,
      ],
    );

  const updatedPayment = result.rows[0];

  if (updatedPayment) {
    return updatedPayment;
  }

  /*
   * A concurrent request may have saved the Stripe
   * ID before this request reached the UPDATE.
   */
  const existingPayment =
    await findPaymentById(paymentId);

  if (!existingPayment) {
    throw new Error(
      "Payment disappeared while saving Stripe PaymentIntent",
    );
  }

  /*
   * Real Stripe idempotency should return the same
   * PaymentIntent to concurrent retries.
   */
  if (
    existingPayment
      .stripe_payment_intent_id !==
    stripePaymentIntentId
  ) {
    throw new Error(
      "Concurrent requests produced different Stripe PaymentIntents",
    );
  }

  return existingPayment;
};

const cancelPaymentForExpiredReservation =
  async (
    reservationId: string,
  ): Promise<CancelExpiredPaymentResult> => {
    const payment =
      await findPaymentByReservationId(
        reservationId,
      );

    /*
     * The reservation expired before the user
     * started a payment operation.
     */
    if (!payment) {
      return {
        kind: "no_payment",
      };
    }

    /*
     * BullMQ can retry a job, so cancellation must
     * be safe when an earlier attempt completed.
     */
    if (payment.status === "CANCELLED") {
      return {
        kind: "already_cancelled",
        paymentId: payment.id,
      };
    }

    /*
     * A successful payment cannot be cancelled.
     * Record that a refund is now required.
     */
    if (payment.status === "SUCCEEDED") {
      await pool.query(
        `
          UPDATE payments
          SET
            status = 'REFUND_PENDING',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status = 'SUCCEEDED'
        `,
        [payment.id],
      );

      return {
        kind: "refund_required",
        paymentId: payment.id,
      };
    }

    /*
     * Do not create duplicate refund work.
     */
    if (
      payment.status === "REFUND_PENDING" ||
      payment.status === "REFUNDED"
    ) {
      return {
        kind: "refund_already_in_progress",
        paymentId: payment.id,
        status: payment.status,
      };
    }

    const stripePaymentIntentId =
      payment.stripe_payment_intent_id;

    /*
     * A CREATING payment may not have reached
     * Stripe yet. Contact Stripe only when the
     * PaymentIntent ID exists.
     */
    if (stripePaymentIntentId !== null) {
      await stripe.paymentIntents.cancel(
        stripePaymentIntentId,
        {},
        {
          idempotencyKey:
            `cancel-expired-${payment.id}`,
        },
      );
    }

    /*
     * Only unfinished states may become CANCELLED.
     * This protects a concurrent success webhook
     * from being overwritten.
     */
    const cancellationResult =
      await pool.query<PaymentRow>(
        `
          UPDATE payments
          SET
            status = 'CANCELLED',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status IN (
              'CREATING',
              'PENDING',
              'PROCESSING',
              'FAILED'
            )
          RETURNING
            id,
            reservation_id,
            stripe_payment_intent_id,
            amount_cents,
            currency,
            status,
            failure_code,
            failure_message,
            paid_at,
            refunded_at,
            created_at,
            updated_at
        `,
        [payment.id],
      );

    const cancelledPayment =
      cancellationResult.rows[0];

    if (cancelledPayment) {
      return {
        kind: "cancelled",
        paymentId: cancelledPayment.id,
        stripePaymentIntentId:
          cancelledPayment
            .stripe_payment_intent_id,
      };
    }

    /*
     * Another request changed the payment while
     * this function was contacting Stripe.
     */
    const latestPayment =
      await findPaymentById(payment.id);

    if (!latestPayment) {
      throw new Error(
        "Payment disappeared during expiration cancellation",
      );
    }

    if (latestPayment.status === "CANCELLED") {
      return {
        kind: "already_cancelled",
        paymentId: latestPayment.id,
      };
    }

    if (latestPayment.status === "SUCCEEDED") {
      await pool.query(
        `
          UPDATE payments
          SET
            status = 'REFUND_PENDING',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status = 'SUCCEEDED'
        `,
        [latestPayment.id],
      );

      return {
        kind: "refund_required",
        paymentId: latestPayment.id,
      };
    }

    if (
      latestPayment.status ===
        "REFUND_PENDING" ||
      latestPayment.status === "REFUNDED"
    ) {
      return {
        kind: "refund_already_in_progress",
        paymentId: latestPayment.id,
        status: latestPayment.status,
      };
    }

    throw new Error(
      `Payment could not be cancelled from status ${latestPayment.status}`,
    );
  };

const requireClientSecret = (
  clientSecret: string | null,
): string => {
  if (clientSecret === null) {
    throw new Error(
      "Stripe PaymentIntent did not return a client secret",
    );
  }

  return clientSecret;
};

const createOrReusePaymentIntent =
  async (
    reservationId: string,
    userId: string,
  ): Promise<CreatePaymentIntentResult> => {
    /*
     * Phase 1:
     * Validate the reservation and prepare the
     * local PostgreSQL payment.
     */
    const preparation =
      await preparePaymentForReservation(
        reservationId,
        userId,
      );

    /*
     * This covers:
     * - reservation_not_found
     * - reservation_not_payable
     * - reservation_expired
     */
    if (preparation.kind !== "ready") {
      return preparation;
    }

    const payment = preparation.payment;

    /*
     * A successful payment must not be restarted.
     */
    if (payment.status === "SUCCEEDED") {
      return {
        kind: "already_paid",
        payment,
      };
    }

    /*
     * These terminal or refund-related states
     * cannot continue through the normal pay flow.
     */
    if (
      payment.status === "CANCELLED" ||
      payment.status ===
        "REFUND_PENDING" ||
      payment.status === "REFUNDED"
    ) {
      return {
        kind: "payment_unavailable",
        status: payment.status,
      };
    }

    /*
     * If our payment row already has a Stripe ID,
     * retrieve and reuse that PaymentIntent.
     */
    if (
      payment.stripe_payment_intent_id !==
      null
    ) {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(
          payment.stripe_payment_intent_id,
        );

      const clientSecret =
        requireClientSecret(
          paymentIntent.client_secret,
        );

      return {
        kind: "payment_ready",
        payment,
        clientSecret,
        reused: true,
      };
    }

    /*
     * No Stripe PaymentIntent exists yet.
     *
     * This HTTP request happens after the earlier
     * PostgreSQL transaction has committed.
     */
    const paymentIntent =
      await stripe.paymentIntents.create(
        {
          amount: payment.amount_cents,

          currency:
            payment.currency.toLowerCase(),

          payment_method_types: [
            "card",
          ],

          metadata: {
            paymentId: payment.id,

            reservationId:
              payment.reservation_id,
          },
        },
        {
          /*
           * Every retry for this local payment uses
           * the same Stripe idempotency key.
           */
          idempotencyKey:
            `payment-${payment.id}`,
        },
      );

    /*
     * Save Stripe's ID after Stripe successfully
     * creates the PaymentIntent.
     */
    const updatedPayment =
      await saveStripePaymentIntent(
        payment.id,
        paymentIntent.id,
      );

    const clientSecret =
      requireClientSecret(
        paymentIntent.client_secret,
      );

    return {
      kind: "payment_ready",
      payment: updatedPayment,
      clientSecret,
      reused: false,
    };
  };

export {
  cancelPaymentForExpiredReservation,
  createOrReusePaymentIntent,
  getPaymentByIdForUser,
  preparePaymentForReservation,
  type CancelExpiredPaymentResult,
  type CreatePaymentIntentResult,
  type PaymentRow,
  type PreparePaymentResult,
};
