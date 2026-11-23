# REQ-02 · Horario de lunes a viernes de 08:00 a 18:00

- **Tipo:** requerimiento
- **Estado:** En curso
- **Prioridad:** P2
- **Área:** api / web
- **Estimación:** M
- **Sprint:** Semana 1 (23 al 27 nov 2026)
- **Reportado:** 2026-11-22

## Objetivo

Alinear la plataforma con el horario real del espacio: atención de **lunes a
viernes de 08:00 a 18:00**, con tres franjas reservables y sin reservas los fines
de semana.

## Alcance

### Incluido

- Reemplazar las franjas `09–13`, `14–18` y `18–22` por `08–11`, `11–15` y
  `15–18`.
- Restringir altas y modificaciones de reservas a lunes, martes, miércoles,
  jueves y viernes, para todos los roles.
- Exponer los días de apertura en la configuración de la API y en el resumen
  público.
- Migrar automáticamente el `settings.json` existente al iniciar la API.
- Actualizar mapa, wizard, operación diaria y home.
- Calcular la capacidad disponible de los reportes sobre días hábiles.
- Actualizar README y documentación del ítem.

### Excluido

- Feriados nacionales o provinciales.
- Edición de horarios desde la interfaz.
- Reprogramación masiva de reservas históricas de fin de semana o de la franja
  `noche`.
- Cambios de capacidad, equipamiento o plano.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Franjas | `manana` 08:00–11:00 · `mediodia` 11:00–15:00 · `tarde` 15:00–18:00 |
| Días de apertura | `openingDays: [1, 2, 3, 4, 5]` |
| Roles | La restricción aplica también al administrador |
| Datos existentes | Migración idempotente al cargar `settings.json`; las reservas históricas se conservan |
| Fuera de horario | La API devuelve `closed` en disponibilidad y ocupación |

## Plan de trabajo

- [x] Agregar `openingDays` a `SettingsRecord` y a la semilla.
- [x] Definir franjas y helpers de días hábiles en `common/slots.ts`.
- [x] Validar `DATE_CLOSED` en alta y edición de reservas.
- [x] Migrar configuraciones viejas al iniciar la API.
- [x] Ajustar semilla de reservas para no generar datos en días cerrados.
- [x] Devolver estado `closed` en disponibilidad y ocupación.
- [x] Exponer `openingDays`, `todayOpen` y `nextOpenDate` en la configuración.
- [x] Recalcular capacidad de reportes por días hábiles.
- [x] Actualizar wizard, mapa, operación diaria y home.
- [x] Actualizar README.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Reservas viejas con `noche` o en fin de semana | Se conservan; la etiqueta de franja se deriva de `startsAt`/`endsAt`. |
| `settings.json` ya persistido | Migración automática e idempotente con suba de revisión. |
| Selector de fecha nativo sin bloqueo de fines de semana | Validación en wizard, mapa y operación; navegación que saltea fines de semana. |
| Reportes con denominadores inflados | Capacidad calculada sólo con días hábiles y ocupación filtrada a esos días. |
| Hoy es domingo | La fecha inicial resuelve al lunes siguiente. |

## Criterios de aceptación

- [x] `GET /api/v1/config` devuelve tres franjas dentro de 08:00–18:00 y
      `openingDays: [1,2,3,4,5]`.
- [x] Una reserva de sábado o domingo se rechaza con `DATE_CLOSED` para socio y
      administrador.
- [x] Disponibilidad y ocupación de un día cerrado responden `closed: true`.
- [x] Un `settings.json` viejo se migra al iniciar sin perder reservas.
- [x] La home, el mapa, el wizard y la operación diaria muestran el horario
      nuevo.
- [x] Los reportes calculan capacidad y ocupación sobre días hábiles.
- [x] `npm run typecheck` y `npm run build` pasan.
- [x] Prueba manual de los tres roles.

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| 2026-11-22 | Nuevo | Relevado desde `requerimientos.md`. |
| 2026-11-22 | Refinado | Se definieron franjas, migración y alcance por rol. |
| 2026-11-22 | En curso | Implementación de API, web y documentación. |
