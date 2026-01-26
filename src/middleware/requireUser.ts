import type { Request, Response, NextFunction } from "express";
import { supabaseAuth } from "../supabase";

export type AuthedRequest = Request & { userId?: string; userEmail?: string };

export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Missing Authorization: Bearer <token>" });
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid/expired token" });
    }

    req.userId = data.user.id;
    req.userEmail = data.user.email ?? undefined;
    return next();
  } catch (e) {
    return res.status(500).json({ error: "Auth middleware error" });
  }
}
