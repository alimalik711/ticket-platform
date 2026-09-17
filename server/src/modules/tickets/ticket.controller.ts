import type { RequestHandler } from "express";

import {
  getTicketsByUserId,
} from "./ticket.service.js";

const getTickets: RequestHandler = async (
  _request,
  response,
  next,
) => {
  try {
    const tickets = await getTicketsByUserId(
      response.locals.user.id,
    );

    response.status(200).json({
      status: "success",
      data: {
        tickets,
      },
    });
  } catch (error) {
    next(error);
  }
};

export { getTickets };
