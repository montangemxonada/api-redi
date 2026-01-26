import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";

import { supabaseAdmin } from "./supabase";
import { requireUser, type AuthedRequest } from "./middleware/requireUser";
import { generateSlug, normalizeSlug, isSlugValid } from "./utils/slug";

const PORT = Number(process.env.PORT || 3001);
const WEB_BASE_URL = (process.env.WEB_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const PUBLIC_API_BASE_URL = (process.env.PUBLIC_API_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

const app = express();
app.set("trust proxy", true);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.length === 0) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Public redirect endpoint:
 * - if link.requires_auth = false: 302 to target
 * - if link.requires_auth = true: 302 to WEB_BASE_URL/go/:slug (web will enforce login)
 */
app.get("/r/:slug", async (req, res) => {
  const slug = normalizeSlug(req.params.slug);

  const { data, error } = await supabaseAdmin
    .from("links")
    .select("id, slug, target_url, enabled, requires_auth")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return res.status(500).send("Server error");
  if (!data || !data.enabled) return res.status(404).send("Not found");

  // fire and forget clicks
  supabaseAdmin
    .from("link_clicks")
    .insert({
      link_id: data.id,
      slug: data.slug,
      ip: (req.headers["x-forwarded-for"] as string | undefined) || req.ip,
      ua: req.headers["user-agent"] || null,
      ref: req.headers.referer || null
    })
    .then(() => {})
    .catch(() => {});

  if (data.requires_auth) {
    const to = `${WEB_BASE_URL}/go/${encodeURIComponent(data.slug)}`;
    return res.redirect(302, to);
  }

  return res.redirect(302, data.target_url);
});

/**
 * Resolve a slug to the target URL (requires login).
 */
app.get("/resolve/:slug", requireUser, async (req: AuthedRequest, res) => {
  const slug = normalizeSlug(req.params.slug);

  const { data, error } = await supabaseAdmin
    .from("links")
    .select("id, slug, target_url, enabled, requires_auth")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return res.status(500).json({ error: "Server error" });
  if (!data || !data.enabled) return res.status(404).json({ error: "Not found" });

  // If requires_auth, this endpoint is fine (already authed)
  return res.json({ target_url: data.target_url, slug: data.slug });
});

/**
 * CRUD for user's links
 */
const CreateLinkBody = z.object({
  target_url: z.string().url(),
  slug: z.string().optional(),
  title: z.string().max(120).optional(),
  requires_auth: z.boolean().optional().default(false)
});

app.post("/links", requireUser, async (req: AuthedRequest, res) => {
  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user_id = req.userId!;

  let slug = parsed.data.slug ? normalizeSlug(parsed.data.slug) : generateSlug(7);
  if (!isSlugValid(slug)) return res.status(400).json({ error: "Invalid slug" });

  // Ensure uniqueness; if conflict and slug was auto, retry a few times
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabaseAdmin
      .from("links")
      .insert({
        user_id,
        slug,
        target_url: parsed.data.target_url,
        title: parsed.data.title || null,
        requires_auth: parsed.data.requires_auth,
        enabled: true
      })
      .select("id, slug, target_url, title, requires_auth, enabled, created_at")
      .single();

    if (!error) {
      return res.status(201).json({
        link: data,
        short_url: `${PUBLIC_API_BASE_URL}/r/${data.slug}`
      });
    }

    // Unique violation: slug already exists
    if (String(error.message || "").toLowerCase().includes("duplicate") || String(error.code || "").includes("23505")) {
      if (parsed.data.slug) {
        return res.status(409).json({ error: "Slug already in use" });
      }
      slug = generateSlug(7);
      continue;
    }

    return res.status(500).json({ error: "Failed to create" });
  }

  return res.status(500).json({ error: "Could not generate unique slug" });
});

app.get("/links", requireUser, async (req: AuthedRequest, res) => {
  const user_id = req.userId!;

  const { data, error } = await supabaseAdmin
    .from("links")
    .select("id, slug, target_url, title, requires_auth, enabled, created_at, updated_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Failed to list" });

  return res.json({
    links: data,
    public_base: `${PUBLIC_API_BASE_URL}/r/`
  });
});

const UpdateLinkBody = z.object({
  slug: z.string().optional(),
  target_url: z.string().url().optional(),
  title: z.string().max(120).nullable().optional(),
  requires_auth: z.boolean().optional(),
  enabled: z.boolean().optional()
});

app.put("/links/:id", requireUser, async (req: AuthedRequest, res) => {
  const user_id = req.userId!;
  const id = req.params.id;

  const parsed = UpdateLinkBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const update: Record<string, any> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (update.slug) {
    update.slug = normalizeSlug(update.slug);
    if (!isSlugValid(update.slug)) return res.status(400).json({ error: "Invalid slug" });
  }

  // Ownership check
  const { data: existing, error: e1 } = await supabaseAdmin
    .from("links")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (e1) return res.status(500).json({ error: "Server error" });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.user_id !== user_id) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabaseAdmin
    .from("links")
    .update(update)
    .eq("id", id)
    .select("id, slug, target_url, title, requires_auth, enabled, created_at, updated_at")
    .single();

  if (error) {
    if (String(error.message || "").toLowerCase().includes("duplicate") || String(error.code || "").includes("23505")) {
      return res.status(409).json({ error: "Slug already in use" });
    }
    return res.status(500).json({ error: "Failed to update" });
  }

  return res.json({
    link: data,
    short_url: `${PUBLIC_API_BASE_URL}/r/${data.slug}`
  });
});

app.delete("/links/:id", requireUser, async (req: AuthedRequest, res) => {
  const user_id = req.userId!;
  const id = req.params.id;

  // Ownership check
  const { data: existing, error: e1 } = await supabaseAdmin
    .from("links")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (e1) return res.status(500).json({ error: "Server error" });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.user_id !== user_id) return res.status(403).json({ error: "Forbidden" });

  const { error } = await supabaseAdmin.from("links").delete().eq("id", id);
  if (error) return res.status(500).json({ error: "Failed to delete" });

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API running on :${PORT}`);
});
