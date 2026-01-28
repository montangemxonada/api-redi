import express from "express";
import cors from "cors";
import { config } from "./config";
import { limiter } from "./middleware/ratelimit";
import { publicRoutes } from "./routes/public";
import { privateRoutes } from "./routes/private";
import { analyticsRoutes } from "./routes/analytics";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(limiter);

app.get("/", (_, res) => res.json({ ok: true }));

app.use("/public", publicRoutes);
app.use("/private", privateRoutes);
app.use("/analytics", analyticsRoutes);

process.on("unhandledRejection", r => console.error("UNHANDLED", r));
process.on("uncaughtException", e => console.error("UNCAUGHT", e));

app.listen(config.port, () => {
  console.log(`[xln-api] listening on :${config.port}`);
});