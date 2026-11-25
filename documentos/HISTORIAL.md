# Historial de trabajos realizados

Registro cronológico inverso (lo más reciente arriba). No se edita ni se borra lo
anterior: las correcciones se agregan como una entrada nueva.

Cada entrada debe incluir fecha, ítem, estado, commit, cambios, verificación y
notas. Los ítems cerrados también se reflejan en
[`BACKLOG.md`](BACKLOG.md).

## 2026-11-24 · REQ-03 — Espacios y equipamiento del relevamiento

- **Ítems:** REQ-03.
- **Estado:** Hecho.
- **Commit:** `0e22a8e`
- **Cambios:**
  - Plano: Coworking 1 con 20 puestos, Aula de Capacitaciones con 15 pupitres y
    Sala de Reuniones con 10 (45 asientos, 19 muebles). El generador completa los
    asientos que faltaban en el SVG y valida capacidades y límites de cada
    ambiente.
  - Inventario semilla: `NB-001`, `NB-002`, `PJ-001` y `PZ-001`. La pizarra
    desplazable es un tipo de equipamiento reservable sin accesorios obligatorios.
  - API: DTOs, disponibilidad, asignación de equipos, reportes y resumen público
    incorporan pizarras; el límite de personas por reserva pasa de 12 a 20.
  - Web: asistente con pizarra y tope de 20 personas, panel de equipamiento con
    filtros y alta de pizarras, home, mapa y tablero del director actualizados.
  - `README.md` con capacidades, inventario y totales del plano reales.
- **Verificación:**
  - `npm run typecheck` y `npm run build` completos, sin errores.
  - Prueba manual sobre API con `DATA_DIR` temporal y semilla nueva:
    - Resumen público: 20/15/10 puestos y 2 notebooks, 1 proyector y 1 pizarra.
    - Reserva de 20 personas en Coworking, 15 en el Aula y 10 en la Sala de
      Reuniones, con la cantidad de asientos esperada.
    - Pizarra pedida en una reserva, entregada y devuelta desde el panel sin
      accesorios obligatorios.
    - Reporte del director con el indicador de pizarras.
- **Notas:** la semilla sólo se genera cuando no hay datos. El entorno local
  conserva `data/` con el inventario anterior; para ver el nuevo hay que
  respaldarlo y regenerarlo. El `mapa.drawio.svg` sigue dibujando 10 pupitres y
  18 puestos de Coworking: el manifiesto generado es la fuente de la UI hasta que
  se actualice el SVG fuente.

## 2026-11-21 · BUG-02 — Login 500 con nginx

- **Ítems:** BUG-02.
- **Estado:** Hecho.
- **Commit:** `7bc0222` (guarda de puertos); sin cambios en el código de producto.
- **Cambios:**
  - Se detuvo una instancia vieja de la API (`node dist/main`) que ocupaba el
    puerto `4000` y se reinició `npm run dev`.
  - `tools/dev/check-ports.mjs` + script `predev`: `npm run dev` falla con un
    mensaje claro si `3000` o `4000` ya están ocupados.
- **Verificación:** por `http://localhost` (nginx): health `200`, login `201` con
  2 cookies, `/auth/me` `200`, alta y cancelación de reserva `201`, SSE con
  evento `snapshot`. `npm run typecheck` y `npm run build` sin errores.
- **Notas:** el 500 no venía de nginx, los datos ni las credenciales; una
  instancia aislada con el mismo `dist` y una copia de los datos respondió `201`.
  No se pudo capturar el stack del proceso viejo porque se detuvo durante el
  diagnóstico.

## 2026-11-21 · TEC-04 — Verificación y cierre de nginx local

- **Ítems:** TEC-04.
- **Estado:** Hecho.
- **Commit:** `2dcd96a` (configuración); verificación sin cambios de código.
- **Cambios:** ninguno adicional.
- **Verificación:** con nginx activo en `:80` y la app en modo nginx
  (`WEB_ORIGIN=http://localhost`, `NEXT_PUBLIC_API_URL=/api/v1`):
  - `GET /` y `GET /ingresar` → `200`.
  - `POST /api/v1/auth/login` → `201` con cookies `cw_access` y `cw_refresh`.
  - `GET /api/v1/auth/me` con cookie → `200`.
  - Alta y cancelación de reserva con acompañante → `201`.
  - `GET /api/v1/stream/occupancy` → evento `snapshot` sin buffering.
- **Notas:** TEC-04 cerrado. La decisión de proxy/TLS para producción sigue
  pendiente en TEC-03.

## 2026-11-20 · TEC-04 — Proxy nginx local

- **Ítems:** TEC-04.
- **Estado:** En revisión.
- **Commit:** `2dcd96a`
- **Cambios:**
  - `deploy/nginx/local.conf`: proxy `/api/` → `127.0.0.1:4000` y `/` →
    `127.0.0.1:3000`, con SSE sin buffering, WebSocket de HMR y cabeceras de
    seguridad equivalentes al Caddyfile.
  - `deploy/nginx/install-local.sh`: copia el sitio, desactiva el `default`,
    valida con `nginx -t` y recarga el servicio.
  - `deploy/nginx/README.md` y variables de `.env` para el modo nginx.
- **Verificación:** `nginx -t` con puerto alternativo OK; `bash -n` OK.
- **Notas:** falta ejecutar el script y probar `http://localhost` con login,
  reserva y mapa en vivo.

## 2026-11-20 · TEC-01 — Higiene de datos y lockfile

- **Ítems:** TEC-01.
- **Estado:** Hecho.
- **Commit:** `909eb27` (ignore); revert de `package-lock.json` sin commit.
- **Cambios:**
  - `apps/api/data/` se agregó a `.gitignore` y se verificó con `git check-ignore`.
  - Se restauró la versión commiteada de `package-lock.json`: el diff sólo quitaba
    metadatos `libc: ["glibc"]` de paquetes opcionales.
- **Verificación:** `git status` sin cambios pendientes en el lockfile.
- **Notas:** el árbol queda limpio para empezar REQ-01.

## 2026-11-20 · BUG-01 — Verificación y cierre

- **Ítems:** BUG-01.
- **Estado:** Hecho.
- **Commit:** sin cambios de código; verificación sobre `a95255e`.
- **Cambios:** ninguno.
- **Verificación:** el usuario probó en Chrome el popup de nueva reserva:
  escritura fluida con acompañantes, alta y baja de filas y creación de la reserva.
  También se revisaron los demás modales.
- **Notas:** BUG-01 cerrado.

## 2026-11-20 · BUG-01 — Foco del modal en el popup de reserva

- **Ítems:** BUG-01.
- **Estado:** En revisión.
- **Commit:** `a95255e`
- **Cambios:**
  - `Modal` ya no re-ejecuta el efecto de apertura cuando cambia `onClose`: usa un
    ref y depende sólo de `open`.
  - El enfoque inicial no se aplica si el foco ya está dentro del diálogo.
- **Verificación:** `npm run typecheck` y `npm run build` completos, sin errores.
- **Notas:** falta la prueba manual en Chrome con 2 acompañantes y la revisión de
  los demás modales. Al confirmarse, BUG-01 pasa a `Hecho`.

## 2026-11-20 · Semana 0 — Sistema de trabajo documental

- **Ítems:** TEC-01 y documentación base.
- **Estado:** Hecho.
- **Commit:** `909eb27`
- **Cambios:**
  - Se creó `AGENTS.md` raíz con contexto, comandos, reglas críticas, flujo de
    backlog, DoR/DoD y convenciones de commits.
  - Se crearon `documentos/BACKLOG.md`, `AGENDA.md`, `HISTORIAL.md`,
    `items/BUG-01.md`, `items/REQ-01.md`, `plantillas/item.md` y
    `decisiones/ADR-001-sin-docker.md`.
  - Se conservaron `requerimientos.md` y `bugs.md` como bandeja de entrada.
  - Se agregó `apps/api/data/` a `.gitignore`.
  - Se enlazó la documentación de trabajo desde el `README.md`.
- **Verificación:** revisión manual de enlaces y consistencia de IDs.
- **Notas:** BUG-01 queda como primer foco de la Semana 1. Falta confirmar el
  navegador y la frecuencia de reproducción.

---

## Cómo registrar una entrada

```markdown
## AAAA-MM-DD · Semana N — Título breve

- **Ítems:** BUG-01, TEC-01
- **Estado:** Hecho
- **Commit:** `abc1234`
- **Cambios:** qué se modificó y por qué.
- **Verificación:** comandos y pruebas manuales ejecutadas.
- **Notas:** pendientes, riesgos o seguimiento.
```
