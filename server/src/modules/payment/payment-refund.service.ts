import type {
  QueryResultRow,
} from "pg";

import { pool } from "../../db/pool.js";
import { stripe } from "../../stripe/client.js";

type RefundablePaymentStatus =
  | "CREATING"
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED";

interface PaymentForRefundRow
  extends QueryResultRow {
  id: string;

  stripe_payment_intent_id:
    | string
    | null;

  status: RefundablePaymentStatus;
}

type ProcessPaymentRefundResult =
  | {
      kind: "refunded";
      paymentId: string;
      stripeRefundId: string;
    }
  | {
      kind: "already_refunded";
      paymentId: string;
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "not_refund_pending";
      status: RefundablePaymentStatus;
    };

const findPaymentForRefund = async (
  paymentId: string,
): Promise<PaymentForRefundRow | undefined> => {
  const result =
    await pool.query<PaymentForRefundRow>(
      `
        SELECT
          id,
          stripe_payment_intent_id,
          status
        FROM payments
        WHERE id = $1
      `,
      [paymentId],
    );

  return result.rows[0];
};

const processPaymentRefund = async (
  paymentId: string,
): Promise<ProcessPaymentRefundResult> => {
  const payment =
    await findPaymentForRefund(paymentId);

  if (!payment) {
    return {
      kind: "not_found",
    };
  }

  if (payment.status === "REFUNDED") {
    return {
      kind: "already_refunded",
      paymentId: payment.id,
    };
  }

  if (payment.status !== "REFUND_PENDING") {
    return {
      kind: "not_refund_pending",
      status: payment.status,
    };
  }

  if (!payment.stripe_payment_intent_id) {
    throw new Error(
      "Refund-pending payment has no Stripe PaymentIntent ID",
    );
  }

  const stripeRefund =
    await stripe.refunds.create(
      {
        payment_intent:
          payment.stripe_payment_intent_id,
      },
      {
        idempotencyKey:
          `refund-${payment.id}`,
      },
    );

  const updateResult =
    await pool.query<PaymentForRefundRow>(
      `
        UPDATE payments
        SET
          status = 'REFUNDED',
          refunded_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND status = 'REFUND_PENDING'
        RETURNING
          id,
          stripe_payment_intent_id,
          status
      `,
      [payment.id],
    );

  const updatedPayment =
    updateResult.rows[0];

  if (updatedPayment) {
    return {
      kind: "refunded",
      paymentId: updatedPayment.id,
      stripeRefundId: stripeRefund.id,
    };
  }

  const latestPayment =
    await findPaymentForRefund(payment.id);

  if (latestPayment?.status === "REFUNDED") {
    return {
      kind: "already_refunded",
      paymentId: latestPayment.id,
    };
  }

  throw new Error(
    "Payment status changed while processing its refund",
  );
};

export {
  processPaymentRefund,
  type ProcessPaymentRefundResult,
};