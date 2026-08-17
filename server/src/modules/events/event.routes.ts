import { Router } from "express";

import {
  getEventSeats,
  getPublishedEvent,
  getPublishedEvents,
} from "./event.controller.js";

const eventRouter = Router();

eventRouter.get("/",
  getPublishedEvents
  );

eventRouter.get(
  "/:eventId/seats",
  getEventSeats,
);

eventRouter.get(
  "/:eventId",
  getPublishedEvent,
);

export { eventRouter };