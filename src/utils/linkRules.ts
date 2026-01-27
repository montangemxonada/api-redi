import type { LinkRow } from "../types.js";

export type LinkStatus =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INACTIVE" | "EXPIRED" | "EXHAUSTED" };

export function evaluateStatus(link: LinkRow | null): LinkStatus {
  if (!link) return { ok: false, code: "NOT_FOUND" };
  if (!link.active) return { ok: false, code: "INACTIVE" };

  if (link.expires_at) {
    const exp = new Date(link.expires_at).getTime();
    if (Number.isFinite(exp) && Date.now() > exp) return { ok: false, code: "EXPIRED" };
  }

  if (link.one_time && link.click_count >= 1) return { ok: false, code: "EXHAUSTED" };
  if (link.click_limit != null && link.click_count >= link.click_limit) return { ok: false, code: "EXHAUSTED" };

  return { ok: true };
}

export function protectionFlags(link: LinkRow) {
  return {
    requires_auth: !!link.requires_auth,
    requires_password: !!link.password_hash,
  };
}
