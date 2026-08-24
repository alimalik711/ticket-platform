import {
  Router,
  raw,
} from "express";

import {
  handleStripeWebhook,
} from "./stripe-webhook.controller.js";

const stripeWebhookRouter = Router();

stripeWebhookRouter.post(
  "/",
  raw({
    type: "application/json",
    limit: "100kb",
  }),
  handleStripeWebhook,
);

export { stripeWebhookRouter };