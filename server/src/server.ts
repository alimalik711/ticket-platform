import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.log(
    `Ticket API is running on http://localhost:${env.PORT}`,
  );
});

export { server };