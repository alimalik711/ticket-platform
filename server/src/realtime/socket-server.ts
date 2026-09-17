import type {
  Server as HttpServer,
} from "node:http";

import {
  Server as SocketIOServer,
} from "socket.io";

import { z } from "zod";

const eventIdSchema = z
  .string()
  .uuid(
    "eventId must be a valid UUID",
  );

type JoinEventResult =
  | {
      success: true;
      room: string;
    }
  | {
      success: false;
      message: string;
    };

interface ClientToServerEvents {
  "event:join": (
    eventId: string,
    acknowledge?: (
      result: JoinEventResult,
    ) => void,
  ) => void;
}

interface ServerToClientEvents {
  "seat.updated": (
    data: {
      eventId: string;
      seatId: string;
      status:
        | "AVAILABLE"
        | "HELD"
        | "SOLD";
      heldUntil: string | null;
    },
  ) => void;
}

let io:
  | SocketIOServer<
      ClientToServerEvents,
      ServerToClientEvents
    >
  | null = null;

const initializeSocketServer = (
  httpServer: HttpServer,
): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
> => {
  if (io !== null) {
    throw new Error(
      "Socket.IO server has already been initialized",
    );
  }

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents
  >(httpServer);

  io.on("connection", (socket) => {
    console.log(
      "Socket.IO client connected",
      {
        socketId: socket.id,
      },
    );

    socket.on(
      "event:join",
      async (
        eventId,
        acknowledge,
      ) => {
        const parsedEventId =
          eventIdSchema.safeParse(eventId);

        if (!parsedEventId.success) {
          acknowledge?.({
            success: false,
            message:
              "eventId must be a valid UUID",
          });

          return;
        }

        /*
         * Remove the socket from any previous event
         * rooms. socket.id is its private room and
         * must not be removed.
         */
        for (const room of socket.rooms) {
          if (
            room.startsWith("event:")
          ) {
            await socket.leave(room);
          }
        }

        const room =
          `event:${parsedEventId.data}`;

        await socket.join(room);

        console.log(
          "Socket.IO client joined event room",
          {
            socketId: socket.id,
            eventId:
              parsedEventId.data,
            room,
          },
        );

        acknowledge?.({
          success: true,
          room,
        });
      },
    );

    socket.on(
      "disconnect",
      (reason) => {
        console.log(
          "Socket.IO client disconnected",
          {
            socketId: socket.id,
            reason,
          },
        );
      },
    );
  });

  return io;
};

const getSocketServer =
  (): SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents
  > => {
    if (io === null) {
      throw new Error(
        "Socket.IO server has not been initialized",
      );
    }

    return io;
  };

export {
  getSocketServer,
  initializeSocketServer,
};