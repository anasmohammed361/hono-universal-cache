import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./router/index.js";

const port = Number(process.env.PORT) || 3000;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`Redis cache enabled at ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  }
);
