# xln.es API (Render) — resolve & validate (no redirect)

✅ Regla: la API **NO redirige**. Solo:
- Resuelve slugs
- Valida reglas (activo/expira/clicks)
- Aplica protecciones (login, clave)
- Registra analytics (clicks) **solo cuando entrega target_url**

## Stack
- Node.js + Express + TypeScript
- Supabase (Postgres)
- JWT verificado con `jose` (JWKS o JWT secret)
- Rate limit por IP

## Deploy en Render (rápido)
1. Subes este repo a GitHub.
2. En Render: **New > Web Service** (Node).
3. Build: `npm ci && npm run build`
4. Start: `npm run start`
5. Variables (Render > Environment):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGIN` (ej: `https://xln.es,http://localhost:3000`)
   - `SUPABASE_JWKS_URL` (recomendado) **o** `SUPABASE_JWT_SECRET`

## Endpoints

### Public
- `GET /public/resolve/:slug`
  - Si es FREE (sin auth y sin password) devuelve `target_url` y registra click.
  - Si está protegido, **NO** devuelve destino; retorna tipo de protección + preview.

- `POST /public/verify-password`
  - Para links con password **sin** login. Si password es correcta, devuelve `target_url` y registra click.

### Private (JWT Supabase)
- `GET /private/resolve/:slug`
  - Requiere token (Bearer).
  - Si el link requiere password, responde `PASSWORD_REQUIRED` (no filtra target).

- `POST /private/verify-password`
  - Requiere token. Para `login + clave`. Si OK, devuelve `target_url` y registra click.

- `GET /analytics/:linkId`
  - Requiere token. Solo dueño. Devuelve clicks por día + total + last_access.

### Health
- `GET /health`

## Notas importantes
- Esta API usa **service role** para DB (bypassa RLS). La seguridad del dueño se valida con el `sub` del JWT.
- Recomendado: activar RLS para el frontend (dashboard) y mantener el backend con service role.

## SQL
Mira `supabase/schema.sql`.
