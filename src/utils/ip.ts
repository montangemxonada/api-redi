import type { Request } from "express";

export function getClientIp(req: Request): string {
  // Render/Proxies: trust proxy enabled in app
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0]!.trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]);
  return req.ip || "";
}
