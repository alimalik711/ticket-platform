import { Router } from "express";
import { createReservation } from "./reservation.controller.js"
import { requireAuth } from "../../middlewares/require-auth.js";

const reservationRouter = Router();

reservationRouter.post(
  "/",
  requireAuth,
  createReservation,
);

export { reservationRouter };