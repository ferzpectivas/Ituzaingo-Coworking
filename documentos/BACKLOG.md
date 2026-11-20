# Backlog

Fuente de verdad de requerimientos, bugs y deuda técnica del Espacio de Coworking
de Ituzaingó.

- Bandeja de entrada: [`requerimientos.md`](requerimientos.md) y [`bugs.md`](bugs.md).
- Agenda semanal: [`AGENDA.md`](AGENDA.md).
- Historial de lo realizado: [`HISTORIAL.md`](HISTORIAL.md).
- Fichas detalladas: [`items/`](items/).
- Plantilla: [`plantillas/item.md`](plantillas/item.md).
- Reglas de trabajo: [`../AGENTS.md`](../AGENTS.md).

## Convenciones

### Identificadores

| Prefijo | Uso |
| --- | --- |
| `REQ-xx` | Requerimiento funcional o de producto. |
| `BUG-xx` | Defecto reproducible. |
| `TEC-xx` | Deuda técnica, infraestructura o documentación. |
| `MEJ-xx` | Mejora incremental sin urgencia. |

Los IDs son estables: no se reciclan ni se renombran. Si un ítem cambia de tipo,
se conserva el ID original y se actualiza el campo `Tipo`.

### Estados

`Nuevo` → `Refinado` → `Listo` → `En curso` → `En revisión` → `Hecho`

Estados laterales: `Bloqueado` (con motivo y responsable) y `Descartado` (con
justificación).

### Prioridad

| Nivel | Criterio |
| --- | --- |
| `P0` | Rompe la operación o la seguridad; se atiende de inmediato. |
| `P1` | Bloquea un flujo principal; entra en el sprint actual. |
| `P2` | Importante pero no bloqueante; se planifica. |
| `P3` | Deseable o de largo plazo. |

### Estimación

| Tamaño | Referencia |
| --- | --- |
| `S` | Hasta 4 horas. |
| `M` | 1 a 2 días. |
| `L` | 3 a 5 días; conviene dividir en subtareas. |

## Resumen

| ID | Título | Tipo | Área | Prioridad | Est. | Estado | Semana | Ficha |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-01 | No se puede escribir el documento del acompañante | bug | web | P1 | M | Hecho | 1 | [ficha](items/BUG-01.md) |
| REQ-01 | Quitar Docker del despliegue | req | infra | P2 | L | Refinado | 2 | [ficha](items/REQ-01.md) |
| TEC-01 | Ignorar `apps/api/data/` y revisar `package-lock.json` | tec | infra | P2 | S | Hecho | 0 | — |
| TEC-02 | Actualizar README tras quitar Docker | tec | docs | P3 | S | Nuevo | 3 | — |
| TEC-03 | ADR de despliegue sin Docker | tec | infra | P2 | S | En revisión | 1 | [ADR-001](decisiones/ADR-001-sin-docker.md) |

## Listo

Sin ítems.

## Refinado

### REQ-01 · Quitar Docker del despliegue

La aplicación se despliega en un VPS sin Docker. Requiere reemplazar Caddy en
contenedor por un proxy nativo, los servicios por `systemd`, los backups por
cron y actualizar la documentación.

- Depende de TEC-03.
- Detalle y subtareas en [`items/REQ-01.md`](items/REQ-01.md).

## Nuevo

### TEC-02 · Actualizar README tras quitar Docker

Reescribir la sección de despliegue, respaldos y rutas de datos (`apps/api/data/`)
una vez cerrado REQ-01.

## En curso

Sin ítems.

## En revisión

### TEC-03 · ADR de despliegue sin Docker

ADR redactado en [`decisiones/ADR-001-sin-docker.md`](decisiones/ADR-001-sin-docker.md).
Estado `Propuesto`: para desarrollo local se usa **nginx**; la opción de producción
(proxy/TLS) queda pendiente antes de implementar REQ-01.

## Hecho

### BUG-01 · No se puede escribir el documento del acompañante

Corregido y verificado en Chrome el 2026-11-20. El `Modal` ya no roba el foco al
re-renderizar el wizard.

- **Commit:** `a95255e`
- Detalle en [`items/BUG-01.md`](items/BUG-01.md).

### TEC-01 · Ignorar `apps/api/data/` y revisar `package-lock.json`

- `apps/api/data/` quedó en `.gitignore` (commit `909eb27`).
- El diff de `package-lock.json` se revirtió: eran 84 líneas de metadatos `libc`
  de paquetes opcionales, sin cambios reales de dependencias.

Los ítems cerrados se registran en [`HISTORIAL.md`](HISTORIAL.md) y permanecen en
la tabla de resumen con estado `Hecho`.
