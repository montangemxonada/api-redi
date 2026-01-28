
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { supabase } from "../supabase.js";

export const publicRoutes = Router();

publicRoutes.get("/resolve/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { data } = await supabase.from("links").select("*").eq("slug", slug).maybeSingle();

    if (!data || !data.active) return res.status(404).json({ message: "NOT_FOUND" });
    if (data.expires_at && new Date(data.expires_at) < new Date()) return res.status(410).json({ message: "EXPIRED" });
    if (data.click_limit && data.click_count >= data.click_limit) return res.status(410).json({ message: "EXHAUSTED" });

    const requiresPassword = !!data.password_hash;
    const requiresAuth = !!data.requires_auth;

    if (!requiresPassword && !requiresAuth) {
      await supabase.from("links").update({ click_count: (data.click_count ?? 0) + 1 }).eq("id", data.id);
      return res.json({ target_url: data.target_url });
    }

    return res.json({
      requires_password: requiresPassword,
      requires_auth: requiresAuth,
      title: data.title,
      note: data.note,
      preview_image: data.preview_image
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "ERROR" });
  }
});

publicRoutes.post("/verify-password", async (req: Request, res: Response) => {
  try {
    const { slug, password } = req.body as { slug: string; password: string };
    const { data } = await supabase.from("links").select("*").eq("slug", slug).maybeSingle();

    if (!data || !data.password_hash) return res.status(403).json({ message: "FORBIDDEN" });

    const ok = await bcrypt.compare(password, data.password_hash);
    if (!ok) return res.status(403).json({ message: "INVALID_PASSWORD" });

    await supabase.from("links").update({ click_count: (data.click_count ?? 0) + 1 }).eq("id", data.id);
    return res.json({ target_url: data.target_url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "ERROR" });
  }
});
