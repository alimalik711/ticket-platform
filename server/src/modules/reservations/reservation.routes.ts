import { Router } from "express";

import {
  requireAuth,
} from "../../middlewares/require-auth.js";

import {
  reservationRateLimit,
} from "../../middlewares/reservation-rate-limit.js";

import {
  cancelReservation,
  createReservation,
  getReservations,
} from "./reservation.controller.js";

const reservationRouter = Router();

reservationRouter.post(
  "/",
  requireAuth,
  reservationRateLimit,
  createReservation,
);

reservationRouter.get(
  "/",
  requireAuth,
  getReservations,
);

reservationRouter.post(
  "/:reservationId/cancel",
  requireAuth,
  cancelReservation,
);

export { reservationRouter };
