import { io, Socket } from "socket.io-client";
import type { SeatUpdatedPayload } from "../types";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected with id:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO] Connection error:", err.message);
    });
  }

  return socket;
}

export function joinEventRoom(
  eventId: string,
  onAck?: (result: { success: boolean; room?: string; message?: string }) => void,
) {
  const s = getSocket();
  if (s.connected) {
    s.emit("event:join", eventId, onAck);
  } else {
    s.once("connect", () => {
      s.emit("event:join", eventId, onAck);
    });
  }
}

export function subscribeToSeatUpdates(
  callback: (payload: SeatUpdatedPayload) => void,
): () => void {
  const s = getSocket();
  const handler = (payload: SeatUpdatedPayload) => {
    callback(payload);
  };

  s.on("seat.updated", handler);

  return () => {
    s.off("seat.updated", handler);
  };
}
