# ADR-008 — El navegador solo habla con la web: rewrite `/api` en Next

- **Estado:** aceptada (2026-11-01, fase 001)
- **Contexto:** web (:3000) y api (:3001) son orígenes distintos en dev. Las cookies de
  sesión de better-auth cross-origin exigirían `SameSite=None; Secure` (frágil en
  localhost HTTP y con proxies corporativos). En producción (F8) Caddy ya servirá ambos
  bajo el mismo dominio.
- **Decisión:** Next `rewrites` en `apps/web/next.config.ts`: `/api/:path*` →
  `${API_URL}/api/:path*` (env server-side, default `http://localhost:3001`). Todo fetch
  del cliente usa rutas relativas (`/api/auth/...`, `/api/health`); la cookie de sesión
  es same-origin (`localhost:3000`) en dev y sigue siéndolo en producción.
- **Alternativas descartadas:** cookies cross-site con CORS+credentials (frágil en dev
  HTTP); dominio compartido solo en prod (no resuelve dev); BFF con server actions
  (sobreingeniería para v1).
- **Consecuencias:** el tráfico del navegador pasa por el proceso de Next (proxy ligero,
  aceptable); `NEXT_PUBLIC_API_URL` deja de usarse en el cliente (se elimina); server
  components pueden seguir llamando a `API_URL` directamente si conviene.
