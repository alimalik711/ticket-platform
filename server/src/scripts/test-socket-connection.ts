
import {
  io,
} from "socket.io-client";

type JoinEventResult =
  | {
      success: true;
      room: string;
    }
  | {
      success: false;
      message: string;
    };

const EVENT_ID =
  "11111111-1111-4111-8111-111111111111";

const socket = io(
  "http://localhost:4000",
  {
    /*
     * Force this test to use the WebSocket
     * transport rather than HTTP polling.
     */
    transports: ["websocket"],
  },
);

const connectionTimeout =
  setTimeout(() => {
    console.error(
      "Socket.IO connection timed out",
    );

    socket.disconnect();
    process.exitCode = 1;
  }, 5000);

socket.on("connect", () => {
  console.log(
    "Test client connected",
    {
      socketId: socket.id,
    },
  );

  socket.emit(
    "event:join",
    EVENT_ID,
    (result: JoinEventResult) => {
      clearTimeout(connectionTimeout);

      console.log(
        "Event room join result",
        result,
      );

      /*
       * Do NOT disconnect here.
       *
       * We want to stay connected so we can
       * receive seat.updated events.
       */
    },
  );
});

/*
 * Listen for realtime seat updates.
 */
socket.on(
  "seat.updated",
  (payload) => {
    console.log(
      "Seat update received",
      payload,
    );
  },
);

socket.on(
  "connect_error",
  (error) => {
    clearTimeout(connectionTimeout);

    console.error(
      "Test client connection failed",
      error.message,
    );

    socket.disconnect();
    process.exitCode = 1;
  },
);

socket.on("disconnect", (reason) => {
  console.log(
    "Test client disconnected",
    {
      reason,
    },
  );
});
