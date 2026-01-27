import type { Request, Response, NextFunction } from "express";
import { cfg } from "../config.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthedRequest = Request & { userId?: string };

function getBearer(req: Request): string {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || "";
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function requireSupabaseJwt(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing Bearer token" });

    if (cfg.supabaseJwtSecret) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(cfg.supabaseJwtSecret), {
        algorithms: ["HS256"],
      });
      const sub = String(payload.sub || "");
      if (!sub) return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
      req.userId = sub;
      return next();
    }

    if (!cfg.supabaseJwksUrl) {
      return res.status(500).json({
        error: "SERVER_MISCONFIG",
        message: "Set SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET",
      });
    }

    if (!jwks) jwks = createRemoteJWKSet(new URL(cfg.supabaseJwksUrl));
    const { payload } = await jwtVerify(token, jwks, {
      // Supabase commonly uses RS256 when JWKS is available.
      algorithms: ["RS256", "ES256", "PS256"],
    });

    const sub = String(payload.sub || "");
    if (!sub) return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
    req.userId = sub;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Token verification failed" });
  }
}
