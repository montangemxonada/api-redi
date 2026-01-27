export function normalizeSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]/g, "");
}

export function isSlugValid(s: string) {
  return s.length >= 3 && s.length <= 32;
}

export function generateSlug(len = 7) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
