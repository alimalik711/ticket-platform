import express from "express";
import {eventRouter} from "./modules/events/event.routes.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { reservationRouter } from "./modules/reservations/reservation.routes.js";
import {
  ticketRouter,
} from "./modules/tickets/ticket.routes.js";
import {
  stripeWebhookRouter,
} from "./modules/webhooks/stripe-webhook.routes.js";

import { errorHandler } from "./middlewares/error-handler.js";
import {
  paymentRouter,
} from "./modules/payment/payment.routes.js";
import {
  requestIdMiddleware,
} from "./middlewares/request-id.js";
import {
  requestLogger,
} from "./middlewares/request-logger.js";

const app = express();


app.use(requestIdMiddleware);
app.use(requestLogger);
app.all("/api/auth/*splat", toNodeHandler(auth));


app.use(
  "/api/v1/webhooks/stripe",
  stripeWebhookRouter,
);


app.use(express.json({ limit: "100kb" }));
app.use("/api/v1/reservations", reservationRouter);
app.use("/api/v1/tickets", ticketRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/events", eventRouter);
app.use(
  "/api/v1/payments",
  paymentRouter,
);

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    message: "Ticket API is running",
  });
});

app.use(errorHandler);

export { app };
