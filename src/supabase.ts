import { createClient } from "@supabase/supabase-js";
import { cfg } from "./config.js";

export const supabaseAdmin = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
