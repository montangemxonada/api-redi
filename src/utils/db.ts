import { supabaseAdmin } from "../supabase.js";
import type { LinkRow } from "../types.js";

export async function getLinkBySlug(slug: string): Promise<LinkRow | null> {
  const { data, error } = await supabaseAdmin
    .from("links")
    .select("*")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as LinkRow | null) ?? null;
}

export async function getLinkById(id: string): Promise<LinkRow | null> {
  const { data, error } = await supabaseAdmin
    .from("links")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as LinkRow | null) ?? null;
}

export async function insertClickAndIncrement(linkId: string, ip: string, userAgent: string) {
  // 1) insert click
  const { error: e1 } = await supabaseAdmin.from("link_clicks").insert({
    link_id: linkId,
    ip,
    user_agent: userAgent,
  });
  if (e1) throw e1;

  // 2) increment click_count
  const { error: e2 } = await supabaseAdmin.rpc("xln_increment_click_count", { p_link_id: linkId });
  if (e2) throw e2;
}

export async function disableLink(linkId: string) {
  const { error } = await supabaseAdmin.from("links").update({ active: false }).eq("id", linkId);
  if (error) throw error;
}
