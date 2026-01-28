
import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";

export const privateRoutes = Router();

privateRoutes.get("/resolve/:slug", requireAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { data } = await supabase.from("links").select("*").eq("slug", slug).maybeSingle();

    if (!data) return res.status(404).json({ message: "NOT_FOUND" });

    await supabase.from("links").update({ click_count: (data.click_count ?? 0) + 1 }).eq("id", data.id);
    return res.json({ target_url: data.target_url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "ERROR" });
  }
});
