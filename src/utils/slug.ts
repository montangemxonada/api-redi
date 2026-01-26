import { nanoid } from "nanoid";

// Base62-ish: letters+digits, url safe
const SAFE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateSlug(len = 7) {
  return nanoid(len).replace(/[-_]/g, () => SAFE[Math.floor(Math.random() * SAFE.length)]);
}

export function normalizeSlug(slug: string) {
  return slug.trim().replace(/^\//, "").replace(/\s+/g, "-");
}

export function isSlugValid(slug: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]{2,40}$/.test(slug);
}
