import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

const startServer = async () => {
  try {
    await pool.query("SELECT 1");

    console.log("PostgreSQL connection successful");

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