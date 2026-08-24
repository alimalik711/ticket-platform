import { env } from "../config/env.js";
import { stripe } from "../stripe/client.js";

/*
 * Read values passed after the script name.
 *
 * Example:
 * npx tsx script.ts pi_123 5000 usd evt_123
 */
const [
  stripePaymentIntentId,
  amountText,
  currency = "usd",
  providedEventId,
] = process.argv.slice(2);

/*
 * The PaymentIntent ID and payment amount are
 * required for the test.
 */
if (
  !stripePaymentIntentId ||
  !amountText
) {
  throw new Error(
    "Provide PaymentIntent ID and amount",
  );
}

/*
 * CMD arguments are always strings.
 * Convert the amount into a number.
 */
const amountReceived =
  Number(amountText);

if (
  !Number.isInteger(amountReceived) ||
  amountReceived < 0
) {
  throw new Error(
    "Amount must be a non-negative integer",
  );
}

/*
 * Use a provided Event ID when testing duplicate
 * delivery. Otherwise generate a fresh Event ID.
 */
const stripeEventId =
  providedEventId ??
  `evt_test_payment_succeeded_${Date.now()}`;

/*
 * Construct Stripe-like webhook JSON.
 */
const payload = JSON.stringify({
  id: stripeEventId,
  object: "event",

  type:
    "payment_intent.succeeded",

  data: {
    object: {
      id: stripePaymentIntentId,
      object: "payment_intent",

      amount_received:
        amountReceived,

      currency,

      status: "succeeded",
    },
  },
});

/*
 * Generate a valid signature for the exact
 * payload string.
 */
const signature =
  stripe.webhooks.generateTestHeaderString({
    payload,

    secret:
      env.STRIPE_WEBHOOK_SECRET,
  });

/*
 * Send the signed event to the real Express
 * webhook endpoint.
 */
const response = await fetch(
  "http://localhost:4000/api/v1/webhooks/stripe",
  {
    method: "POST",

    headers: {
      "Content-Type":
        "application/json",

      "Stripe-Signature":
        signature,
    },

    body: payload,
  },
);

/*
 * Read and print the Express response.
 */
const responseBody =
  await response.text();

console.log({
  status: response.status,
  responseBody,
});