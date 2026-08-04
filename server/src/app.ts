import express from "express";

const app = express();

app.use(express.json({ limit: "100kb" }));

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    message: "Ticket API is running",
  });
});

export { app };