
import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRoutes = Router();

analyticsRoutes.get("/:linkId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const { data } = await supabase.from("link_clicks").select("created_at").eq("link_id", linkId);
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "ERROR" });
  }
});
