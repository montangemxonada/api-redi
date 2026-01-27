import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

export interface AuthedRequest extends Request {
  userId?: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "No token" });

  const token = auth.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return res.status(401).json({ error: "Invalid token" });

  req.userId = data.user.id;
  next();
}
