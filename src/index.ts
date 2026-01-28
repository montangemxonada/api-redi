
import express, { Request, Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { rateLimiter } from "./middleware/rateLimit.js";
import { publicRoutes } from "./routes/public.js";
import { privateRoutes } from "./routes/private.js";
import { analyticsRoutes } from "./routes/analytics.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(rateLimiter);

app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use("/public", publicRoutes);
app.use("/private", privateRoutes);
app.use("/analytics", analyticsRoutes);

process.on("unhandledRejection", r => console.error("UNHANDLED", r));
process.on("uncaughtException", e => console.error("UNCAUGHT", e));

app.listen(config.port, () => {
  console.log(`[xln-api] listening on :${config.port}`);
});
