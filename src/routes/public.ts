import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getLinkBySlug, insertClickAndIncrement, disableLink } from "../utils/db.js";
import { evaluateStatus, protectionFlags } from "../utils/linkRules.js";
import { getClientIp } from "../utils/ip.js";

export const publicRouter = Router();

const slugSchema = z.string().min(2).max(80).regex(/^[a-zA-Z0-9_-]+$/);

publicRouter.get("/resolve/:slug", async (req, res) => {
  const slug = slugSchema.safeParse(req.params.slug).data;
  if (!slug) return res.status(400).json({ error: "BAD_SLUG" });

  const link = await getLinkBySlug(slug);
  const status = evaluateStatus(link);
  if (!status.ok) {
    return res.status(status.code === "NOT_FOUND" ? 404 : 410).json({
      ok: false,
      status: status.code,
      slug,
      preview: link ? { title: link.title, preview_image: link.preview_image } : null,
    });
  }

  const flags = protectionFlags(link!);
  const preview = { title: link!.title, preview_image: link!.preview_image };

  // If protected (auth or password), NEVER leak target_url
  if (flags.requires_auth || flags.requires_password) {
    return res.json({
      ok: true,
      type: "protected",
      slug,
      protection: flags,
      preview,
    });
  }

  // FREE direct: return target_url and register click
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  await insertClickAndIncrement(link!.id, ip, ua);

  // auto-disable if one-time or limit reached after increment
  const after = await getLinkBySlug(slug);
  if (after && (after.one_time && after.click_count >= 1)) await disableLink(after.id);
  if (after && after.click_limit != null && after.click_count >= after.click_limit) await disableLink(after.id);

  return res.json({
    ok: true,
    type: "direct",
    slug,
    target_url: link!.target_url,
    preview,
  });
});

const verifySchema = z.object({
  slug: slugSchema,
  password: z.string().min(1).max(200),
});

publicRouter.post("/verify-password", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_BODY" });

  const { slug, password } = parsed.data;
  const link = await getLinkBySlug(slug);
  const status = evaluateStatus(link);
  if (!status.ok) {
    return res.status(status.code === "NOT_FOUND" ? 404 : 410).json({ ok: false, status: status.code, slug });
  }

  if (!link!.password_hash) {
    return res.status(400).json({ error: "NO_PASSWORD_SET" });
  }

  // For public verify: only allowed when NOT requires_auth
  if (link!.requires_auth) {
    return res.status(401).json({ error: "LOGIN_REQUIRED" });
  }

  const ok = await bcrypt.compare(password, link!.password_hash);
  if (!ok) return res.status(401).json({ error: "INVALID_PASSWORD" });

  // success: return target_url and register click
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  await insertClickAndIncrement(link!.id, ip, ua);

  const after = await getLinkBySlug(slug);
  if (after && (after.one_time && after.click_count >= 1)) await disableLink(after.id);
  if (after && after.click_limit != null && after.click_count >= after.click_limit) await disableLink(after.id);

  return res.json({ ok: true, target_url: link!.target_url });
});
