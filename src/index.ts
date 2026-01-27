import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";

import { supabaseAdmin } from "./supabase.js";
import { requireUser, AuthedRequest } from "./middleware/requireUser.js";
import { generateSlug, normalizeSlug, isSlugValid } from "./utils/slug.js";

const PORT = Number(process.env.PORT || 3000);
const WEB_BASE_URL = (process.env.WEB_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const PUBLIC_API_BASE_URL = (process.env.PUBLIC_API_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

const app = express();
app.set("trust proxy", true);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(morgan("dev"));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.length === 0) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.get("/r/:slug", async (req: Request, res: Response) => {
  const slug = normalizeSlug(req.params.slug);
  const { data } = await supabaseAdmin.from("links").select("*").eq("slug", slug).maybeSingle();
  if (!data || !data.enabled) return res.status(404).send("Not found");
  return res.redirect(data.target_url);
});

const CreateLinkBody = z.object({
  target_url: z.string().url(),
  slug: z.string().optional()
});

app.post("/links", requireUser, async (req: AuthedRequest, res: Response) => {
  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const slug = parsed.data.slug ? normalizeSlug(parsed.data.slug) : generateSlug(7);
  if (!isSlugValid(slug)) return res.status(400).json({ error: "Invalid slug" });

  const { data, error } = await supabaseAdmin.from("links").insert({
    user_id: req.userId,
    slug,
    target_url: parsed.data.target_url,
    enabled: true
  }).select().single();

  if (error) return res.status(500).json({ error: "Failed" });
  res.json({ link: data, short_url: `${PUBLIC_API_BASE_URL}/r/${data.slug}` });
});

app.listen(PORT, () => console.log("API running on", PORT));
