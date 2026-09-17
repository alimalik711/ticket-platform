import type { RequestHandler } from "express";

import { log } from "../utils/logger.js";

const requestLogger: RequestHandler = (
  request,
  response,
  next,
) => {
  const startTime = Date.now();

  response.on("finish", () => {
    const durationMs =
      Date.now() - startTime;

    log("info", "HTTP request completed", {
      requestId: response.locals.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs,
    });
  });
  
  next();
};

export {
  requestLogger,
};