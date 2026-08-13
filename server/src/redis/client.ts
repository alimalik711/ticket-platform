import {Redis} from "ioredis";
import { env } from "../config/env.js";

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

export { redis };