import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import { cfg } from "./config.js";
import { publicRouter } from "./routes/public.js";
import { privateRouter } from "./routes/private.js";
import { requireSupabaseJwt } from "./middleware/auth.js";
import { publicLimiter, passwordLimiter, privateLimiter } from "./middleware/rateLimit.js";

const app = express();

// Important for correct IP when behind Render proxy
app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(express.json({ limit: "256kb" }));
app.use(morgan("tiny"));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/no-origin
    if (cfg.corsOrigin.includes("*") || cfg.corsOrigin.includes(origin)) return cb(null, true);
    return cb(new Error("CORS"));
  },
  credentials: true,
}));

app.get("/health", (_req, res) => res.json({ ok: true, name: "xln-api", env: cfg.nodeEnv }));

// Extra strict rate limit for password verification (before router)
app.use("/public/verify-password", passwordLimiter);

// Public endpoints (no redirect, only resolve/validate)
app.use("/public", publicLimiter, publicRouter);

// Private endpoints (JWT required)
app.use("/private", privateLimiter, requireSupabaseJwt, privateRouter);

// Root info
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "xln.es API — resolve & validate (no redirect)",
    endpoints: {
      public: ["/public/resolve/:slug", "/public/verify-password"],
      private: ["/private/resolve/:slug", "/private/verify-password", "/private/analytics/:linkId"],
    },
  });
});

// Error handler (CORS / JSON)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = typeof err?.message === "string" ? err.message : "Server error";
  const code = msg === "CORS" ? "CORS_BLOCKED" : "SERVER_ERROR";
  res.status(code === "CORS_BLOCKED" ? 403 : 500).json({ error: code, message: msg });
});

app.listen(cfg.port, () => {
  console.log(`[xln-api] listening on :${cfg.port}`);
});
