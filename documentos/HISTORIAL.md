# Historial de trabajos realizados

Registro cronológico inverso (lo más reciente arriba). No se edita ni se borra lo
anterior: las correcciones se agregan como una entrada nueva.

Cada entrada debe incluir fecha, ítem, estado, commit, cambios, verificación y
notas. Los ítems cerrados también se reflejan en
[`BACKLOG.md`](BACKLOG.md).

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
