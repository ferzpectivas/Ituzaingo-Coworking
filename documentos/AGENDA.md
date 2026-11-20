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
| TEC-01 · Ignorar `apps/api/data/` y revisar `package-lock.json` | P2 | En revisión |

- **Fuera de alcance:** BUG-01 y REQ-01.
- **Riesgos:** ninguno relevante.
- **Cierre:** documentación creada y commiteada (`909eb27`). TEC-01 quedó parcial:
  el ignore está hecho y falta decidir qué hacer con el diff de `package-lock.json`.

## Semana 1 · 23 al 27 nov 2026

**Estado:** en curso (adelantada al 20/11)
**Objetivo:** estabilizar la reserva con acompañantes y decidir la salida de Docker.

| Comprometido | Prioridad | Estado |
| --- | --- | --- |
| BUG-01 · Documento del acompañante no editable | P1 | En revisión |
| TEC-03 · ADR de despliegue sin Docker | P2 | En revisión |

- **Fuera de alcance:** implementación de REQ-01.
- **Riesgos:**
  - Falta la prueba manual en Chrome con el flujo completo.
  - El ajuste de foco del `Modal` afecta a todos los diálogos: probar también
    equipos, operaciones y cuenta.
- **Dependencias:** ninguna.

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
