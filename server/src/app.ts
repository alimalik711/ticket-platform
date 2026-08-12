import express from "express";
import {eventRouter} from "./modules/events/event.routes.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { reservationRouter } from "./modules/reservations/reservation.routes.js";

import { errorHandler } from "./middlewares/error-handler.js";


const app = express();




app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "100kb" }));
app.use("/api/v1/reservations", reservationRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/events", eventRouter);

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    message: "Ticket API is running",
  });
});

app.use(errorHandler);

export { app };