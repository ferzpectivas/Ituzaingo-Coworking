# BUG-02 · Login devuelve 500 con el proxy nginx

- **Tipo:** bug
- **Estado:** Hecho
- **Prioridad:** P1
- **Área:** infra
- **Estimación:** S
- **Sprint:** Semana 1 (23 al 27 nov 2026)
- **Reportado:** 2026-11-20
- **Cerrado:** 2026-11-21

## Descripción

Al probar el entorno detrás de nginx (`http://localhost`), el login de cualquier
cuenta devolvía `500 Internal Server Error` con `code: INTERNAL_ERROR`. El health
de la API seguía respondiendo `200`.

## Pasos para reproducir

1. Tener API y web corriendo y nginx configurado con `deploy/nginx/local.conf`.
2. Abrir `http://localhost` e intentar ingresar con
   `socio@coworking.gob.ar` / `Socio1234!`.
3. Observar la respuesta de `POST /api/v1/auth/login`.

También se reproduce llamando directo a la API:

```bash
curl -i -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -H 'Origin: http://localhost' \
  -d '{"email":"socio@coworking.gob.ar","password":"Socio1234!"}'
```

## Resultado esperado

`201 Created` con las cookies `cw_access` y `cw_refresh`.

## Resultado actual

`500` con `application/problem+json`:

```json
{
  "title": "Error interno",
  "status": 500,
  "code": "INTERNAL_ERROR",
  "detail": "Ocurrió un error inesperado.",
  "instance": "/api/v1/auth/login"
}
```

El 500 aparecía incluso con un email inexistente o una contraseña incorrecta, es
decir, antes de validar credenciales.

## Causa

En el puerto `4000` quedó corriendo una instancia vieja de la API
(`node dist/main`, iniciada a las 17:48) que no correspondía al código ni al
entorno actual. El `nest start --watch` de `npm run dev` no podía tomar el puerto,
así que todas las solicitudes las atendía el proceso viejo, que fallaba con una
excepción inesperada antes de validar las credenciales.

No era un problema de nginx, de los datos ni de las credenciales:

- Llamando directo a `http://localhost:4000` también daba 500.
- Una instancia aislada en `:4100`, con el mismo `dist` y una copia de
  `apps/api/data/`, respondió `201`.
- Al detener el proceso viejo y reiniciar `npm run dev`, el login respondió `201`.

No se pudo capturar el stack exacto porque el proceso se detuvo durante el
diagnóstico.

## Corrección

- Se detuvo la instancia vieja y se reinició el entorno con `npm run dev`.
- Se agregó `tools/dev/check-ports.mjs` y el script `predev`: si `npm run dev`
  encuentra los puertos `3000` o `4000` ocupados, falla con un mensaje que indica
  cómo identificar y cerrar el proceso anterior. Así no vuelve a quedar una API
  vieja atendiendo en silencio.

## Verificación

Prueba de humo completa por `http://localhost` (nginx):

| Caso | Resultado |
| --- | --- |
| `GET /api/v1/health` | `200` |
| `GET /` | `200` |
| `POST /api/v1/auth/login` | `201` y 2 cookies |
| `GET /api/v1/auth/me` con cookie | `200` |
| `POST /api/v1/reservations` (titular + acompañante) | `201` |
| `POST /api/v1/reservations/:id/cancel` | `201` |
| `GET /api/v1/stream/occupancy` (SSE) | evento `snapshot` recibido |

- `npm run predev` con los puertos ocupados: falla con el mensaje esperado.
- `npm run typecheck` y `npm run build`: sin errores.

## Archivos involucrados

- `package.json`
- `tools/dev/check-ports.mjs`
- `deploy/nginx/README.md` (diagnóstico)

## Criterios de aceptación

- [x] El login por `http://localhost` responde `201` con las cookies correctas.
- [x] Los endpoints autenticados aceptan la cookie emitida por nginx.
- [x] Crear y cancelar una reserva funciona por nginx.
- [x] El SSE de ocupación entrega el snapshot inicial.
- [x] `npm run dev` avisa si una instancia vieja ocupa los puertos.
- [x] `npm run typecheck` y `npm run build` pasan.

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| 2026-11-20 | Listo | Reportado al probar el entorno con nginx; 500 incluso con credenciales inválidas. |
| 2026-11-21 | En revisión | Aislado el proceso viejo en `:4000`; reinicio y prueba de humo completa. |
| 2026-11-21 | Hecho | Guarda `predev` agregada (`7bc0222`); login, reserva y SSE verificados por nginx. |
