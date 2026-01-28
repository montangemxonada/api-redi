import rateLimit from "express-rate-limit";

export const limiter = ratelimit({
  windowMs: 60 * 1000,
  max: 120
});