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
- `render.yaml`: Blueprint con los dos servicios. El de API usa runtime nativo
  `node`, health check en `/api/v1/health` y secretos `sync: false`; el de web
  usa build y start propios, `API_ORIGIN` y `NEXT_PUBLIC_API_URL=/api/v1`.
- `apps/api/src/config.ts`: la API también escucha en `PORT` (lo inyecta
  Render); `API_PORT` sigue teniendo prioridad en Docker y dev local.
- `apps/web/package.json`: `start` sin `-p 3000` para respetar `PORT`.
- `package.json` y `tools/dev/start.mjs`: el `start` raíz sigue levantando API
  y web en local, pero con `RENDER=true` arranca sólo el proceso del servicio
  (`SERVICE_ROLE` o el nombre). Así un servicio creado a mano con el comando
  por defecto no choca en el `PORT` inyectado.
- `.nvmrc`: fija Node 24 (mismo major que el Dockerfile).
- `README.md` y `.env.example`: sección de despliegue en Render y variable
  `API_ORIGIN`.

## Segundo bloqueo: `EADDRINUSE` en el deploy

El primer deploy en Render falló con
`[api] Error: listen EADDRINUSE: address already in use 0.0.0.0:10000`. El
servicio estaba ejecutando el `start` raíz, que levanta API y web juntos:
Render inyecta `PORT=10000` en ambos procesos y el segundo no puede escuchar.
Además, el servicio de API no respondía (`x-render-routing: no-server`), así
que el rewrite tampoco tenía destino.

La corrección es explícita: cada servicio usa su comando de arranque
(`start:web` / `start:api`) y `render.yaml` declara los dos. El `start` raíz
queda como red de seguridad para configuraciones manuales viejas.

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
- `npm start` con `RENDER=true` y `RENDER_SERVICE_NAME=ituzaingo-coworking-api`
  resuelve `start:api`; con un nombre que no termina en `-api`, `start:web`.
  En local (sin `RENDER`) sigue resolviendo `start:all`.

## Pendiente

Verificar en Render después de sincronizar el Blueprint (o de fijar los
comandos de build/start de la tabla del README) y redeployar. El servicio de
API tiene que dejar de responder `no-server` y el login debe devolver `201`.

## Archivos involucrados

- `apps/web/next.config.ts`
- `apps/api/src/config.ts`
- `apps/web/package.json`
- `package.json`, `tools/dev/start.mjs`
- `render.yaml`
- `.nvmrc`
- `README.md`, `.env.example`

## Criterios de aceptación

- [x] `GET /api/v1/health` responde `200` a través del rewrite en local.
- [x] Login devuelve `201` con cookies por el mismo origen.
- [x] El SSE de ocupación entrega el snapshot inicial a través del proxy.
- [x] Sin `API_ORIGIN` no se agrega ningún rewrite (local sin cambios).
- [x] Un solo proceso por servicio en Render (sin `EADDRINUSE`).
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
| 2026-11-25 | En revisión | Deploy con `EADDRINUSE`: un proceso por servicio y web + API en el Blueprint. |
