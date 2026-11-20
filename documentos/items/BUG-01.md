# BUG-01 · No se puede escribir el documento del acompañante

- **Tipo:** bug
- **Estado:** En revisión
- **Prioridad:** P1
- **Área:** web
- **Estimación:** M
- **Sprint:** Semana 1 (23 al 27 nov 2026)
- **Reportado:** 2026-11-20

## Descripción

El socio crea una reserva, agrega personas y, al llegar al paso de identificación
de acompañantes, no puede escribir en el campo de número de documento.

## Pasos para reproducir

1. Ingresar con una cuenta de socio en Chrome.
2. Abrir el mapa y comenzar una reserva.
3. Elegir ambiente, fecha y franja; avanzar al paso de personas.
4. Agregar uno o más acompañantes.
5. Intentar escribir el nombre, apellido o número de documento.

## Resultado esperado

Cada campo acepta y conserva el texto mientras se escribe. Agregar o quitar
acompañantes no borra los datos ya cargados.

## Resultado actual

El campo registra un solo carácter y pierde el foco; el resto de las teclas no
llega al input.

## Causa confirmada

El efecto de apertura de `Modal` dependía de `onClose`, y `ReservationWizard` le
pasa una función `close` nueva en cada render. Cada tecla re-renderiza el wizard,
el efecto se vuelve a ejecutar y a los 30 ms hace `panelRef.current.focus()`, con
lo que el input pierde el foco.

- `apps/web/src/components/ui/primitives.tsx:206-219` (efecto de apertura)
- `apps/web/src/components/reservations/reservation-wizard.tsx:331-334` (`close` inline)
- `apps/web/src/components/map/map-workspace.tsx:420-431` (`onClose` inline)

La hipótesis del estado duplicado (`people.length` vs. `partySize`) no fue la
causa de este defecto; queda como observación para una revisión futura.

## Plan de trabajo

- [x] Reproducir en Chrome, en el popup de "Nueva reserva".
- [x] Confirmar que el foco se pierde por el efecto del `Modal`.
- [x] Corregir el efecto: depende sólo de `open`, usa un ref para `onClose` y no
      roba el foco si ya hay interacción dentro del diálogo.
- [ ] Verificar en Chrome que se pueden escribir varios caracteres seguidos.
- [ ] Probar agregar/quitar acompañantes sin perder datos.
- [x] Ejecutar `npm run typecheck -w @ituzaingo/web` y
      `npm run build -w @ituzaingo/web`.

## Archivos involucrados

- `apps/web/src/components/ui/primitives.tsx`
- `apps/web/src/components/reservations/reservation-wizard.tsx`
- `apps/web/src/components/map/map-workspace.tsx`

## Criterios de aceptación

- [ ] Se puede escribir nombre, apellido y documento de cada acompañante.
- [ ] Agregar y quitar acompañantes conserva los datos de las filas restantes.
- [ ] La reserva con 2 acompañantes se crea correctamente desde el mapa.
- [ ] Los demás modales (equipos, operaciones, cuenta) siguen funcionando.
- [x] `npm run typecheck -w @ituzaingo/web` y `npm run build -w @ituzaingo/web`
      pasan.

## Datos de reproducción

- **Navegador:** Chrome.
- **Lugar:** popup de "Nueva reserva" del mapa.
- **Comportamiento:** se escribe un carácter y el foco vuelve al diálogo.

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| 2026-11-20 | Listo | Relevado por el usuario; hipótesis inicial registrada. |
| 2026-11-20 | En revisión | Causa confirmada y corregida en `Modal`; falta prueba manual en Chrome. |
