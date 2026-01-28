export const config = {
  port: process.env.PORT || 10000,
  supabaseUrl: process.env.SUPABASE_URL!,
  serviceRole: process.env.SUPABASE_SERVICE_ROLE!,
  jwksUrl: process.env.SUPABASE_JWKS_URL!
};