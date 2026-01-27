import dotenv from "dotenv";
dotenv.config();

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const cfg = {
  port: Number(process.env.PORT || 10000),
  nodeEnv: process.env.NODE_ENV || "development",

  corsOrigin: (process.env.CORS_ORIGIN || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),

  supabaseUrl: must("SUPABASE_URL"),
  supabaseServiceRoleKey: must("SUPABASE_SERVICE_ROLE_KEY"),

  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || "",
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL || "",

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitPublicMax: Number(process.env.RATE_LIMIT_PUBLIC_MAX || 120),
  rateLimitPasswordMax: Number(process.env.RATE_LIMIT_PASSWORD_MAX || 30),
  rateLimitPrivateMax: Number(process.env.RATE_LIMIT_PRIVATE_MAX || 240),
};
