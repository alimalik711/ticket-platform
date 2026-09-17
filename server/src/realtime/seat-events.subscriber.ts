import {
  redis,
} from "../redis/client.js";

import {
  getSocketServer,
} from "./socket-server.js";

import {
  SEAT_UPDATES_CHANNEL,
  seatUpdatedEventSchema,
} from "./seat-events.js";

/*
 * A Redis connection that enters subscriber mode
 * should only be used for receiving Pub/Sub messages.
 */
const seatUpdatesSubscriber =
  redis.duplicate();

let isInitialized = false;

const initializeSeatUpdatesSubscriber =
  async (): Promise<void> => {
    if (isInitialized) {
      throw new Error(
        "Seat updates subscriber has already been initialized",
      );
    }

    /*
     * Register the message handler before subscribing,
     * so it is ready when Redis sends a message.
     */
    seatUpdatesSubscriber.on(
      "message",
      (channel, message) => {
        if (
          channel !==
          SEAT_UPDATES_CHANNEL
        ) {
          return;
        }

        try {
          /*
           * Redis gives us a string. Convert that
           * JSON string back into a JavaScript value.
           */
          const parsedJson: unknown =
            JSON.parse(message);

          /*
           * Validate the received message before
           * sending it to connected clients.
           */
          const parsedEvent =
            seatUpdatedEventSchema.safeParse(
              parsedJson,
            );

          if (!parsedEvent.success) {
            console.error(
              "Invalid seat update received from Redis",
              {
                issues:
                  parsedEvent.error.issues,
              },
            );

            return;
          }

          const event = parsedEvent.data;

          /*
           * Only users viewing this particular event
           * should receive the seat update.
           */
          const room =
            `event:${event.eventId}`;

          getSocketServer()
            .to(room)
            .emit(
              "seat.updated",
              event,
            );

          console.log(
            "Seat update sent through Socket.IO",
            {
              room,
              seatId: event.seatId,
              status: event.status,
            },
          );
        } catch (error) {
          console.error(
            "Failed to process Redis seat update",
            error,
          );
        }
      },
    );

    await seatUpdatesSubscriber.subscribe(
      SEAT_UPDATES_CHANNEL,
    );

    isInitialized = true;

    console.log(
      "Subscribed to Redis seat updates",
      {
        channel:
          SEAT_UPDATES_CHANNEL,
      },
    );
  };


  const closeSeatUpdatesSubscriber =
  async (): Promise<void> => {
    if (!isInitialized) {
      return;
    }

    await seatUpdatesSubscriber.quit();

    isInitialized = false;

    console.log(
      "Redis seat updates subscriber closed",
    );
  };

export {
  initializeSeatUpdatesSubscriber,
  seatUpdatesSubscriber,
  closeSeatUpdatesSubscriber,
};