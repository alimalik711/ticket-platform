import { env } from "../config/env.js";
import { stripe } from "../stripe/client.js";

const [
  stripePaymentIntentId,
  providedEventId,
] = process.argv.slice(2);

if (!stripePaymentIntentId) {
  throw new Error(
    "Usage: npx tsx src/scripts/send-test-payment-failed.ts <payment-intent-id> [event-id]",
  );
}

const stripeEventId =
  providedEventId ??
  `evt_test_payment_failed_${Date.now()}`;

const payload = JSON.stringify({
  id: stripeEventId,
  object: "event",
  type: "payment_intent.payment_failed",

  data: {
    object: {
      id: stripePaymentIntentId,
      object: "payment_intent",
      status: "requires_payment_method",

      last_payment_error: {
        code: "card_declined",
        message: "Your card was declined.",
      },
    },
  },
});

const signature =
  stripe.webhooks.generateTestHeaderString({
    payload,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });

const response = await fetch(
  "http://localhost:4000/api/v1/webhooks/stripe",
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },

    body: payload,
  },
);

const responseBody = await response.text();

console.log({
  status: response.status,
  responseBody,
});