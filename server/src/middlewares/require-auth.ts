import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../auth/auth.js";

const requireAuth: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      response.status(401).json({
        status: "error",
        message: "Authentication required",
      });

      return;
    }

    response.locals.user = session.user;
    response.locals.session = session.session;

    next();
  } catch (error) {
    next(error);
  }
};

export { requireAuth };