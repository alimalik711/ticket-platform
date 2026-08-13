import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { redis } from "./redis/client.js";

const startServer = async () => {
  try {
    await pool.query("SELECT 1");

    console.log("PostgreSQL connection successful");

    

const redisResponse = await redis.ping();

console.log(`Redis connection successful: ${redisResponse}`);

    app.listen(env.PORT, () => {
      console.log(
        `Ticket API is running on http://localhost:${env.PORT}`,
      );
    });
  } catch (error) {
    console.error("Failed to start the application:", error);
    await pool.end();
    process.exit(1);
  }
};

void startServer();