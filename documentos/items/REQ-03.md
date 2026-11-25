# REQ-03 · Adecuar espacios y equipamiento al relevamiento

- **Tipo:** requerimiento
- **Estado:** Hecho
- **Prioridad:** P2
- **Área:** web
- **Estimación:** L
- **Sprint:** Semana 1 (23 al 27 nov 2026)
- **Reportado:** 2026-11-23

## Descripción

El relevamiento del espacio indica capacidades y equipamiento distintos de los
que tenía la demo:

| Ambiente / recurso | Relevamiento |
| --- | --- |
| Coworking 1 | 20 personas |
| Aula de Capacitaciones (2) | 15 personas, con pizarra y pupitres |
| Sala de Reuniones (3) | 10 personas |
| Notebooks | 2 |
| Proyector | 1 |
| Pizarra desplazable | 1, reservable |

La plataforma debe reservar esas capacidades reales, ofrecer la pizarra como
equipamiento reservable y reflejar el inventario en la web pública y en los
reportes.

## Objetivo y alcance

### Incluido

- Ajustar el manifiesto del plano a 20/10/15 asientos (45 en total).
- Renombrar los ambientes: **Coworking 1** y **Aula de Capacitaciones**.
- Reemplazar el inventario semilla por 2 notebooks, 1 proyector y 1 pizarra.
- Alta del tipo de equipamiento `pizarra`, sin accesorios obligatorios.
- Permitir pedir la pizarra en el asistente de reserva y gestionarla en el panel.
- Subir el límite de personas por reserva de 12 a 20.
- Actualizar home, API pública, reportes y `README.md`.

### Excluido

- Horarios y días de atención (REQ-02: lunes a viernes de 8:00 a 18:00).
- Rediseño del plano o mobiliario definitivo del edificio.
- Migración de la persistencia JSON.

## Hipótesis / notas técnicas

- El plano se genera desde `mapa.drawio.svg` con `tools/floorplan/build-floorplan.mjs`.
  El SVG dibuja 10 pupitres y 18 puestos de Coworking; el generador completa los
  asientos faltantes de forma determinista y valida las capacidades del
  relevamiento. **El SVG de referencia queda pendiente de actualización**: el
  manifiesto es la fuente de verdad de la UI.
- La pizarra se modela como `EquipmentType = 'pizarra'` con
  `REQUIRED_ACCESSORIES` vacío; el checklist sólo registra observaciones.
- La semilla sólo se aplica cuando no hay datos. En un entorno con datos de demo
  hay que respaldar y borrar el directorio `data/` para regenerarlos.

## Plan de trabajo

- [x] Llevar el plano a 20/10/15 asientos y regenerar el manifiesto.
- [x] Renombrar ambientes en el manifiesto.
- [x] Actualizar tipos, semilla e inventario (2 notebooks, 1 proyector, 1 pizarra).
- [x] Agregar `pizarra` a DTOs, servicios, disponibilidad, reservas y reportes.
- [x] Extender el asistente y el panel de equipamiento.
- [x] Subir el límite de personas a 20.
- [x] Actualizar textos públicos y README.
- [x] Verificar con `npm run typecheck`, `npm run build` y prueba manual.

## Criterios de aceptación

- [x] Coworking 1 = 20 puestos, Aula de Capacitaciones = 15, Sala de Reuniones = 10.
- [x] Se puede reservar 20 personas en Coworking y 15 en el Aula con asientos válidos.
- [x] La Sala de Reuniones se reserva completa para 10 personas.
- [x] Inventario inicial: 2 notebooks, 1 proyector y 1 pizarra desplazable.
- [x] La pizarra se puede pedir, entregar y devolver desde el panel.
- [x] Home, API pública y README muestran las capacidades e inventario reales.
- [x] `npm run typecheck` y `npm run build` pasan.

## Dependencias y riesgos

| Ítem | Tipo | Nota |
| --- | --- | --- |
| REQ-02 | req | Horarios de atención; no bloquea este ítem pero afecta las franjas. |
| Plano fuente | infra | `mapa.drawio.svg` sigue mostrando 10 pupitres; pedir versión actualizada. |
| Datos de demo | infra | Si ya existen datos persistidos, respaldar y borrar `data/` para regenerar la semilla. |

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| 2026-11-23 | En curso | Relevamiento de espacios y equipamiento implementado. |
| 2026-11-23 | En revisión | Verificación técnica pendiente de revisión y commit. |
| 2026-11-24 | Hecho | `npm run typecheck` y `npm run build` OK; prueba manual de socio, administrador y director sobre semilla nueva. Commit `0e22a8e`. |
