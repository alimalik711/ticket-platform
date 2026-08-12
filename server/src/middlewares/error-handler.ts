import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  console.error(error);

  if (response.headersSent) {
    next(error);

    return;
  }

  response.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};

export { errorHandler };