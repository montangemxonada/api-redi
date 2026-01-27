import rateLimit from "express-rate-limit";
import { cfg } from "../config.js";

export const publicLimiter = rateLimit({
  windowMs: cfg.rateLimitWindowMs,
  limit: cfg.rateLimitPublicMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export const passwordLimiter = rateLimit({
  windowMs: cfg.rateLimitWindowMs,
  limit: cfg.rateLimitPasswordMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export const privateLimiter = rateLimit({
  windowMs: cfg.rateLimitWindowMs,
  limit: cfg.rateLimitPrivateMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
