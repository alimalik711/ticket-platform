import {
  createServer,
} from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

import {
  initializeSocketServer,
} from "./realtime/socket-server.js";

import {
  initializeSeatUpdatesSubscriber,
  closeSeatUpdatesSubscriber,
} from "./realtime/seat-events.subscriber.js";

import { redis } from "./redis/client.js";

/*
 * Create one Node HTTP server that can handle:
 *
 * 1. Normal Express HTTP requests.
 * 2. Socket.IO real-time connections.
 */
const httpServer = createServer(app);

/*
 * Gracefully shut down the application.
 *
 * When the operating system asks the application to stop,
 * we close resources in an orderly way instead of
 * immediately killing the process.
 */
const shutdown = async (
  signal: string,
): Promise<void> => {
  console.log(
    `Received ${signal}. Shutting down...`,
  );

  /*
   * Stop accepting new HTTP connections.
   *
   * Existing requests are allowed to finish.
   */
  httpServer.close(async () => {
    console.log(
      "HTTP server stopped accepting new connections",
    );

    /*
     * Close the Redis Pub/Sub subscriber.
     */
    await closeSeatUpdatesSubscriber();

    /*
     * Close the normal Redis connection.
     */
    await redis.quit();

    /*
     * Close all PostgreSQL connections
     * in the connection pool.
     */
    await pool.end();

    console.log("Shutdown complete");

    process.exit(0);
  });
};

const startServer = async (): Promise<void> => {
  try {
    await pool.query("SELECT 1");

    console.log(
      "PostgreSQL connection successful",
    );

    const redisResponse =
      await redis.ping();

    console.log(
      `Redis connection successful: ${redisResponse}`,
    );

    /*
     * Attach Socket.IO before the HTTP server
     * begins accepting connections.
     */
    initializeSocketServer(httpServer);

    /*
     * Start listening for Redis seat updates.
     */
    await initializeSeatUpdatesSubscriber();

    httpServer.listen(env.PORT, () => {
      console.log(
        `Ticket API is running on http://localhost:${env.PORT}`,
      );

      console.log(
        `Socket.IO server is running on http://localhost:${env.PORT}`,
      );
    });
  } catch (error) {
    console.error(
      "Failed to start the application:",
      error,
    );

    await pool.end();
    await redis.quit();

    process.exit(1);
  }
};

/*
 * SIGINT is normally received when we press Ctrl+C.
 */
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

/*
 * SIGTERM is commonly used by Docker,
 * cloud platforms, and process managers
 * when stopping the application.
 */
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void startServer();