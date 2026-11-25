# BUG-03 · Login devuelve 404 en Render

- **Tipo:** bug
- **Estado:** En revisión
- **Prioridad:** P1
- **Área:** infra
- **Estimación:** S
- **Sprint:** Semana 1 (23 al 27 nov 2026)
- **Reportado:** 2026-11-25

## Descripción

Publicada la app en `https://ituzaingo-coworking.onrender.com/`, el formulario
de `/ingresar` no puede iniciar sesión: `POST /api/v1/auth/login` responde el
`404` HTML de Next.js en lugar de la respuesta de la API. La página en sí
responde `200` y renderiza correctamente.

## Pasos para reproducir

1. Abrir `https://ituzaingo-coworking.onrender.com/ingresar`.
2. Ingresar con `socio@coworking.gob.ar` / `Socio1234!`.
3. Observar el error de la petición de login en la pestaña Red.

También se reproduce sin navegador:

```bash
curl -i -X POST https://ituzaingo-coworking.onrender.com/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"socio@coworking.gob.ar","password":"Socio1234!"}'
```

**Esperado:** `201 Created` con las cookies `cw_access` y `cw_refresh`.
**Actual:** `404` con `text/html` y `<title>404: This page could not be found.</title>`.

## Causa

En local (Docker Compose y nginx) hay un reverse proxy que enruta `/api/*` a
la API y el resto a Next.js. En Render sólo corre el servicio web: no hay
nadie delante que tome `/api/*`, así que la ruta la resuelve Next.js, que no
tiene rutas `/api` y devuelve su 404. El bundle usa `NEXT_PUBLIC_API_URL=/api/v1`
(relativa), correcta para un solo origen, pero en ese origen no estaba la API.

Comprobaciones:

- `GET /ingresar` → `200` con el formulario (la página no está rota).
- `GET /api/v1/health` en el dominio de la web → `404` HTML de Next.
- El bundle desplegado referencia `/api/v1` (no `localhost:4000`).

## Corrección

- `apps/web/next.config.ts`: rewrite condicional `/api/:path*` →
  `${API_ORIGIN}/api/:path*`, sólo cuando `API_ORIGIN` está definida. Sin la
  variable el comportamiento local (Caddy, nginx, `npm run dev`) no cambia.
  Next 16 hornea los rewrites en `routes-manifest.json` al compilar: la
  variable tiene que estar presente en el build.
- `render.yaml` (nuevo): Blueprint con el servicio de API en Render (runtime
  nativo `node`, health check en `/api/v1/health`, secretos `sync: false`).
- `apps/api/src/config.ts`: la API también escucha en `PORT` (lo inyecta
  Render); `API_PORT` sigue teniendo prioridad en Docker y dev local.
- `apps/web/package.json`: `start` sin `-p 3000` para respetar `PORT`.
- `.nvmrc`: fija Node 24 (mismo major que el Dockerfile).
- `README.md` y `.env.example`: sección de despliegue en Render y variable
  `API_ORIGIN`.

## Verificación

Prueba local con la misma topología (web en `:3000` con rewrite, API en `:4000`):

| Caso | Resultado |
| --- | --- |
| `GET /api/v1/health` por la web | `200` con JSON de la API |
| `POST /api/v1/auth/login` | `201` y las 2 cookies reenviadas |
| `GET /api/v1/auth/me` con cookie | `200` |
| `Origin` no permitido | rechazado por CORS (`Origen no permitido`) |
| Ruta inexistente de la API | `404` `application/problem+json` (no HTML de Next) |
| `GET /api/v1/stream/occupancy` (SSE) | `text/event-stream`; snapshot recibido con la conexión abierta |

- `npm run typecheck` y `npm run build`: sin errores.

## Pendiente

Verificar en Render después de crear el servicio de API, definir `API_ORIGIN`
en el servicio web y redeployar (pasos en `README.md`).

## Archivos involucrados

- `apps/web/next.config.ts`
- `apps/api/src/config.ts`
- `apps/web/package.json`
- `render.yaml`
- `.nvmrc`
- `README.md`, `.env.example`

## Criterios de aceptación

- [x] `GET /api/v1/health` responde `200` a través del rewrite en local.
- [x] Login devuelve `201` con cookies por el mismo origen.
- [x] El SSE de ocupación entrega el snapshot inicial a través del proxy.
- [x] Sin `API_ORIGIN` no se agrega ningún rewrite (local sin cambios).
- [x] `npm run typecheck` y `npm run build` pasan.
- [ ] Login funcional en `https://ituzaingo-coworking.onrender.com/ingresar`.

## Dependencias y riesgos

| Ítem | Tipo | Nota |
| --- | --- | --- |
| REQ-01 | req | Render tiene disco efímero: los datos no persisten sin disco pago. |

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| 2026-11-25 | Nuevo | Reportado al publicar en Render: 404 en el login. |
| 2026-11-25 | En curso | Diagnóstico: falta el enrutamiento de `/api/*` en Render. |
| 2026-11-25 | En revisión | Rewrite + Blueprint implementados y verificados en local; falta el deploy en Render. |
