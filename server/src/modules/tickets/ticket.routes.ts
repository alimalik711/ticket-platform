import { Router } from "express";

import {
  requireAuth,
} from "../../middlewares/require-auth.js";

import {
  getTickets,
} from "./ticket.controller.js";

const ticketRouter = Router();

ticketRouter.get(
  "/",
  requireAuth,
  getTickets,
);

export { ticketRouter };
