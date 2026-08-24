import { env } from "../config/env.js";
import { stripe } from "../stripe/client.js";

const payload = JSON.stringify({
  id: `evt_test_${Date.now()}`,
  object: "event",
  type: "payment_intent.created",

  data: {
    object: {
      id: "pi_test_created",
      object: "payment_intent",
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

const responseBody =
  await response.text();

console.log({
  status: response.status,
  responseBody,
});