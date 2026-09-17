import type {
  RequestHandler,
} from "express";

import type Stripe from "stripe";

import { env } from "../../config/env.js";

import {
  schedulePaymentRefund,
} from "../../queues/payment-refund.queue.js";

import { stripe } from "../../stripe/client.js";

import {
  processPaymentFailed,
  processPaymentSucceeded,
} from "./stripe-webhook.service.js";

const handleStripeWebhook: RequestHandler =
  async (
    request,
    response,
    next,
  ) => {
    const signature = request.get(
      "stripe-signature",
    );

    if (!signature) {
      response.status(400).json({
        status: "error",
        message:
          "Stripe-Signature header is required",
      });

      return;
    }

    let event: Stripe.Event;

    try {
      event =
        stripe.webhooks.constructEvent(
          request.body,
          signature,
          env.STRIPE_WEBHOOK_SECRET,
        );
    } catch {
      response.status(400).json({
        status: "error",
        message:
          "Invalid Stripe webhook signature",
      });

      return;
    }

    try {
      if (
        event.type ===
        "payment_intent.succeeded"
      ) {
        const paymentIntent =
          event.data.object;

        const result =
          await processPaymentSucceeded(
            event.id,
            event.type,
            paymentIntent.id,
            paymentIntent.amount_received,
            paymentIntent.currency,
          );

        /*
         * A late payment means Stripe received
         * the money, but the reservation could no
         * longer be fulfilled.
         *
         * The service has already changed the
         * payment to REFUND_PENDING.
         *
         * Now schedule the actual refund as a
         * BullMQ job.
         */
        if (
          result.kind === "late_payment"
        ) {
          await schedulePaymentRefund(
            result.paymentId,
          );
        }

        console.log(
          "Stripe payment success processed",
          {
            stripeEventId: event.id,

            stripePaymentIntentId:
              paymentIntent.id,

            result,
          },
        );
      } else if (
        event.type ===
        "payment_intent.payment_failed"
      ) {
        const paymentIntent =
          event.data.object;

        const failureCode =
          paymentIntent
            .last_payment_error
            ?.code ?? null;

        const failureMessage =
          paymentIntent
            .last_payment_error
            ?.message ?? null;

        const result =
          await processPaymentFailed(
            event.id,
            event.type,
            paymentIntent.id,
            failureCode,
            failureMessage,
          );

        console.log(
          "Stripe payment failure processed",
          {
            stripeEventId: event.id,

            stripePaymentIntentId:
              paymentIntent.id,

            failureCode,
            failureMessage,

            result,
          },
        );
      } else {
        console.log(
          "Ignoring unsupported Stripe event",
          {
            stripeEventId: event.id,
            eventType: event.type,
          },
        );
      }

      /*
       * Only acknowledge the webhook after all
       * required processing has succeeded.
       *
       * If database processing or refund-job
       * scheduling fails, next(error) is called
       * instead and Stripe can retry the webhook.
       */
      response.status(200).json({
        received: true,
      });
    } catch (error) {
      next(error);
    }
  };

export { handleStripeWebhook };