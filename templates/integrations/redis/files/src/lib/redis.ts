import { RedisClient } from "bun";
import { env } from "../config/env.ts";

export const redis = new RedisClient(env.REDIS_URL);
