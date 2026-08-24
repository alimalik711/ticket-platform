import {
  Router,
} from "express";

import {
  requireAuth,
} from "../../middlewares/require-auth.js";

import {
  createPaymentIntent,
} from "./payment.controller.js";

const paymentRouter = Router();

paymentRouter.post(
  "/reservations/:reservationId/intent",
  requireAuth,
  createPaymentIntent,
);

export { paymentRouter };