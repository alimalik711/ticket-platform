import { Router } from "express";

import {
  requireAuth,
} from "../../middlewares/require-auth.js";

import {
  reservationRateLimit,
} from "../../middlewares/reservation-rate-limit.js";

import {
  createReservation,
} from "./reservation.controller.js";

const reservationRouter = Router();

reservationRouter.post(
  "/",
  requireAuth,
  reservationRateLimit,
  createReservation,
);

export { reservationRouter };