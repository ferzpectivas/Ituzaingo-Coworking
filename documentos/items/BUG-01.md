# BUG-01 · No se puede escribir el documento del acompañante

- **Tipo:** bug
- **Estado:** Listo
- **Prioridad:** P1
- **Área:** web
- **Estimación:** M
- **Sprint:** Semana 1 (23 al 27 nov 2026)
- **Reportado:** 2026-11-20

## Descripción

El socio crea una reserva, agrega personas y, al llegar al paso de identificación
de acompañantes, no puede escribir en el campo de número de documento.

## Pasos para reproducir

1. Ingresar con una cuenta de socio.
2. Abrir el mapa y comenzar una reserva.
3. Elegir ambiente, fecha y franja; avanzar al paso de personas.
4. Agregar uno o más acompañantes.
5. Intentar escribir el nombre, apellido o número de documento.

## Resultado esperado

Cada campo acepta y conserva el texto mientras se escribe. Agregar o quitar
acompañantes no borra los datos ya cargados.

## Resultado actual

El campo de documento no registra las teclas o pierde el foco durante la carga.

## Hipótesis

1. **Foco del modal:** `Modal` vuelve a enfocar el panel 30 ms después de cada
   re-render porque el efecto depende de `onClose` y usa `setTimeout`
   (`apps/web/src/components/ui/primitives.tsx:206-219`). Si el padre se
   re-renderiza mientras se escribe (por ejemplo, por eventos SSE del mapa), el
   foco se roba y el input deja de recibir teclas.
2. **Estado duplicado:** la cantidad de personas vive en `people.length` y en
   `partySize`; los efectos de sincronización pueden recortar filas y descartar
   lo escrito (`apps/web/src/components/reservations/reservation-wizard.tsx:127-144`
   y `189-192`).

## Plan de trabajo

- [ ] Reproducir en el entorno local con el rol socio y registrar navegador,
      dispositivo y frecuencia.
- [ ] Confirmar si el foco se pierde por el `Modal` o por el re-render del wizard.
- [ ] Corregir el efecto del modal: enfocar sólo al abrir, sin depender de la
      identidad de `onClose`.
- [ ] Unificar la fuente de verdad de personas y tamaño del grupo.
- [ ] Probar que agregar/quitar acompañantes no borre datos.
- [ ] Ejecutar `npm run typecheck` y `npm run build`.

## Archivos involucrados

- `apps/web/src/components/ui/primitives.tsx`
- `apps/web/src/components/reservations/reservation-wizard.tsx`
- `apps/web/src/components/map/map-workspace.tsx` (origen probable de re-renders)

## Criterios de aceptación

- [ ] Se puede escribir nombre, apellido y documento de cada acompañante.
- [ ] Agregar y quitar acompañantes conserva los datos de las filas restantes.
- [ ] La reserva con 2 acompañantes se crea correctamente desde el mapa.
- [ ] Los demás modales (equipos, operaciones, cuenta) siguen funcionando.
- [ ] `npm run typecheck` y `npm run build` pasan.

## Datos por confirmar

- Navegador y dispositivo donde se observó.
- ¿Ocurre siempre o sólo con cierta cantidad de acompañantes?
- ¿Pasa también fuera del mapa (por ejemplo, desde "Mis reservas")?

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| 2026-11-20 | Listo | Relevado por el usuario; hipótesis inicial registrada. |
