# Agenda de trabajo

Sprints semanales, de lunes a viernes. El objetivo es mantener un WIP máximo de
**2 ítems** y cerrar cada semana con el backlog y el historial actualizados.

## Reglas de la semana

| Momento | Qué se hace |
| --- | --- |
| Lunes | Revisar el backlog, elegir hasta 2 ítems `Listo` y completar la sección de la semana. |
| Miércoles | Revisar bloqueos y riesgos; renegociar alcance si hace falta. |
| Viernes | Verificar, mover ítems a `Hecho` y agregar el cierre en `HISTORIAL.md`. |

Capacidad de referencia: 3 a 4 días efectivos por semana, dejando margen para
soporte y reuniones.

## Semana 0 · 20 nov 2026

**Estado:** cerrada
**Objetivo:** dejar instalado el sistema de trabajo documental.

| Comprometido | Prioridad | Estado |
| --- | --- | --- |
| Documentos base: `BACKLOG.md`, `AGENDA.md`, `HISTORIAL.md`, fichas y `AGENTS.md` | P2 | Hecho |
| TEC-01 · Ignorar `apps/api/data/` y revisar `package-lock.json` | P2 | Hecho |

- **Fuera de alcance:** BUG-01 y REQ-01.
- **Riesgos:** ninguno relevante.
- **Cierre:** documentación creada y commiteada (`909eb27`). TEC-01 cerrado: el
  ignore quedó aplicado y el diff de `package-lock.json` se revirtió por ser ruido
  de metadatos `libc`.

## Semana 1 · 23 al 27 nov 2026

**Estado:** en curso (adelantada al 20/11)
**Objetivo:** estabilizar la reserva con acompañantes, adecuar espacios y
equipamiento al relevamiento y decidir la salida de Docker.

| Comprometido | Prioridad | Estado |
| --- | --- | --- |
| BUG-01 · Documento del acompañante no editable | P1 | Hecho |
| BUG-02 · Login devuelve 500 con el proxy nginx | P1 | Hecho |
| BUG-03 · Login devuelve 404 en Render | P1 | En revisión |
| TEC-03 · ADR de despliegue sin Docker | P2 | En revisión |
| TEC-04 · Configurar nginx local para desarrollo | P2 | Hecho |
| REQ-02 · Horario de lunes a viernes 08:00 a 18:00 | P2 | En curso |
| REQ-03 · Adecuar espacios y equipamiento al relevamiento | P2 | Hecho |

- **Fuera de alcance:** implementación de REQ-01.
- **Riesgos:**
  - El ajuste de foco del `Modal` afecta a todos los diálogos: ya se probaron
    equipos, operaciones y cuenta.
  - No ejecutar `npm run build` con `npm run dev` activo: el build reescribe
    `dist` y el watcher puede reiniciar en un estado intermedio.
- **Dependencias:** ninguna.
- **Verificación de nginx:** login, `/auth/me`, alta y cancelación de reserva y SSE
  probados por `http://localhost` el 2026-11-21.
- **Cierre REQ-03:** capacidades 20/15/10 e inventario real verificados el
  2026-11-24 con `npm run typecheck`, `npm run build` y prueba manual de socio,
  administrador y director sobre una semilla nueva. Commit `0e22a8e`.

## Semana 2 · 30 nov al 4 dic 2026

**Estado:** planificada
**Objetivo:** migrar el despliegue a VPS sin Docker.

| Comprometido | Prioridad | Estado |
| --- | --- | --- |
| REQ-01 · Migración a systemd + proxy nativo | P2 | Refinado |

- **Fuera de alcance:** mejoras funcionales.
- **Riesgos:**
  - Ventana de indisponibilidad durante la migración.
  - Certificado TLS y renovación automática.
  - Backups y restauración deben quedar probados antes de apagar Docker.
- **Dependencias:** TEC-03 aprobado.
- **Rollback:** conservar el `docker-compose.yml` y el volumen hasta validar una
  semana completa en el nuevo esquema.

## Semana 3 · 7 al 11 dic 2026

**Estado:** planificada
**Objetivo:** verificar la migración y cerrar documentación.

| Comprometido | Prioridad | Estado |
| --- | --- | --- |
| TEC-02 · Actualizar README tras quitar Docker | P3 | Nuevo |
| Verificación post-migración y retrospectiva | P2 | — |

- **Criterio de cierre:** healthcheck, login por los tres roles, reserva completa,
  backup y restauración ejecutados sobre el nuevo despliegue.

## Sin asignar

Ítems `Nuevo`, `Refinado` o `P3` que todavía no entran en una semana. Se toman
del backlog cuando haya capacidad.
