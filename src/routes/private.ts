import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { AuthedRequest } from "../middleware/auth.js";
import { getLinkBySlug, insertClickAndIncrement, disableLink, getLinkById } from "../utils/db.js";
import { evaluateStatus, protectionFlags } from "../utils/linkRules.js";
import { getClientIp } from "../utils/ip.js";
import { supabaseAdmin } from "../supabase.js";

export const privateRouter = Router();

const slugSchema = z.string().min(2).max(80).regex(/^[a-zA-Z0-9_-]+$/);

privateRouter.get("/resolve/:slug", async (req: AuthedRequest, res) => {
  const slug = slugSchema.safeParse(req.params.slug).data;
  if (!slug) return res.status(400).json({ error: "BAD_SLUG" });

  const link = await getLinkBySlug(slug);
  const status = evaluateStatus(link);
  if (!status.ok) {
    return res.status(status.code === "NOT_FOUND" ? 404 : 410).json({ ok: false, status: status.code, slug });
  }

  const flags = protectionFlags(link!);

  // If link requires auth, this private endpoint satisfies that requirement.
  // If password is also required, do not leak target_url yet.
  if (flags.requires_password) {
    return res.status(403).json({
      ok: true,
      status: "OK",
      slug,
      error: "PASSWORD_REQUIRED",
      protection: flags,
      preview: { title: link!.title, preview_image: link!.preview_image },
    });
  }

  // If link does NOT require auth, you can still use this endpoint (it will work),
  // but the recommended flow is public resolve.
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  await insertClickAndIncrement(link!.id, ip, ua);

  const after = await getLinkBySlug(slug);
  if (after && after.one_time && after.click_count >= 1) await disableLink(after.id);
  if (after && after.click_limit != null && after.click_count >= after.click_limit) await disableLink(after.id);

  return res.json({ ok: true, target_url: link!.target_url });
});

const verifySchema = z.object({
  slug: slugSchema,
  password: z.string().min(1).max(200),
});

privateRouter.post("/verify-password", async (req: AuthedRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_BODY" });

  const { slug, password } = parsed.data;
  const link = await getLinkBySlug(slug);
  const status = evaluateStatus(link);
  if (!status.ok) {
    return res.status(status.code === "NOT_FOUND" ? 404 : 410).json({ ok: false, status: status.code, slug });
  }

  if (!link!.password_hash) return res.status(400).json({ error: "NO_PASSWORD_SET" });

  const ok = await bcrypt.compare(password, link!.password_hash);
  if (!ok) return res.status(401).json({ error: "INVALID_PASSWORD" });

  // success: return target_url and register click
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  await insertClickAndIncrement(link!.id, ip, ua);

  const after = await getLinkBySlug(slug);
  if (after && after.one_time && after.click_count >= 1) await disableLink(after.id);
  if (after && after.click_limit != null && after.click_count >= after.click_limit) await disableLink(after.id);

  return res.json({ ok: true, target_url: link!.target_url });
});

// Analytics: clicks por día + total + último acceso (owner only)
privateRouter.get("/analytics/:linkId", async (req: AuthedRequest, res) => {
  const linkId = z.string().uuid().safeParse(req.params.linkId).data;
  if (!linkId) return res.status(400).json({ error: "BAD_ID" });

  const link = await getLinkById(linkId);
  if (!link) return res.status(404).json({ error: "NOT_FOUND" });

  // Owner-only for analytics
  if (link.user_id !== req.userId) return res.status(403).json({ error: "FORBIDDEN" });

  const { data: byDay, error: e1 } = await supabaseAdmin.rpc("xln_clicks_by_day", { p_link_id: linkId });
  if (e1) return res.status(500).json({ error: "DB_ERROR", detail: "xln_clicks_by_day" });

  const { count, error: eCount } = await supabaseAdmin
    .from("link_clicks")
    .select("*", { count: "exact", head: true })
    .eq("link_id", linkId);
  if (eCount) return res.status(500).json({ error: "DB_ERROR", detail: "count" });

  const { data: last, error: eLast } = await supabaseAdmin
    .from("link_clicks")
    .select("created_at")
    .eq("link_id", linkId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eLast) return res.status(500).json({ error: "DB_ERROR", detail: "last" });

  return res.json({
    ok: true,
    link_id: linkId,
    total_clicks: count || 0,
    last_access: last?.created_at || null,
    clicks_by_day: byDay || [],
  });
});
