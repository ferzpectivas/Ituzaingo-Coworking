# Plantilla de ítem

Copiar este archivo a `documentos/items/<ID>.md`, completar los campos y agregar
el ítem a la tabla de resumen de [`../BACKLOG.md`](../BACKLOG.md).

```markdown
# <ID> · <Título>

- **Tipo:** req | bug | tec | mej
- **Estado:** Nuevo
- **Prioridad:** P0 | P1 | P2 | P3
- **Área:** web | api | infra | docs
- **Estimación:** S | M | L
- **Sprint:** Semana N
- **Reportado:** AAAA-MM-DD

## Descripción

Qué problema resuelve o qué comportamiento se espera.

## Pasos para reproducir (sólo bugs)

1. ...
2. ...
3. ...

**Esperado:** ...
**Actual:** ...

## Objetivo y alcance (sólo requerimientos)

### Incluido

- ...

### Excluido

- ...

## Hipótesis / notas técnicas

Archivos, líneas y sospechas relevantes.

## Plan de trabajo

- [ ] ...
- [ ] ...

## Criterios de aceptación

- [ ] ...
- [ ] `npm run typecheck` y `npm run build` pasan.
- [ ] Prueba manual del rol afectado.

## Dependencias y riesgos

| Ítem | Tipo | Nota |
| --- | --- | --- |
| ... | ... | ... |

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| AAAA-MM-DD | Nuevo | Alta del ítem. |
```
