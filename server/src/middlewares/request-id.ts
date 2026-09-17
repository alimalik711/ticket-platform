import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const requestIdMiddleware: RequestHandler = (
  _request,
  response,
  next,
) => {
  const requestId = randomUUID();

  response.locals.requestId = requestId;

  response.setHeader(
    "X-Request-Id",
    requestId,
  );

  next();
};

export {
  requestIdMiddleware,
};