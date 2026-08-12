import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { listPublishedEvents,getPublishedEventById,listSeatsForEvent } from "./event.service.js";

import {z} from "zod";

const getPublishedEvents = async (
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const events = await listPublishedEvents();

    response.status(200).json({
      status: "success",
      data: {
        events,
      },
    });
  } catch (error) {
    next(error);
  }
};



const eventIdSchema = z.string().uuid();

const getPublishedEvent = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  const eventIdResult = eventIdSchema.safeParse(
    request.params.eventId,
  );

  if (!eventIdResult.success) {
    response.status(400).json({
      status: "error",
      message: "eventId must be a valid UUID",
    });

    return;
  }

  try {
    const event = await getPublishedEventById(
      eventIdResult.data,
    );

    if (!event) {
      response.status(404).json({
        status: "error",
        message: "Event not found",
      });

      return;
    }

    response.status(200).json({
      status: "success",
      data: {
        event,
      },
    });
  } catch (error) {
    next(error);
  }
};



const getEventSeats = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  const eventIdResult = eventIdSchema.safeParse(
    request.params.eventId,
  );

  if (!eventIdResult.success) {
    response.status(400).json({
      status: "error",
      message: "eventId must be a valid UUID",
    });

    return;
  }

  try {
    const event = await getPublishedEventById(
      eventIdResult.data,
    );

    if (!event) {
      response.status(404).json({
        status: "error",
        message: "Event not found",
      });

      return;
    }

    const seats = await listSeatsForEvent(
      eventIdResult.data,
    );

    response.status(200).json({
      status: "success",
      data: {
        seats,
      },
    });

    console.log("Seats retrieved successfully:", seats);
  } catch (error) {
    next(error);
  }
};

export { getPublishedEvents, getPublishedEvent ,getEventSeats};