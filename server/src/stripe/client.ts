import Stripe from "stripe";

import { env } from "../config/env.js";

const stripe = new Stripe(
  env.STRIPE_SECRET_KEY,
  {
    host: env.STRIPE_API_HOST,

    port: String(
      env.STRIPE_API_PORT,
    ),

    protocol:
      env.STRIPE_API_PROTOCOL,

    maxNetworkRetries: 2,
  },
);

export { stripe };