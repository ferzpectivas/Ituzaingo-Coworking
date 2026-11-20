# AGENTS.md

Guía de trabajo para agentes y colaboradores del repositorio. Aplica a todo el
monorepo; la app web tiene reglas adicionales en [`apps/web/AGENTS.md`](apps/web/AGENTS.md).

## Contexto

Plataforma de gestión y reservas del Espacio de Coworking municipal de Ituzaingó:
mapa arquitectónico 3D, reservas con titular y acompañantes, equipamiento con
checklists, tablero de dirección y auditoría inmutable.

| Rol | Alcance |
| --- | --- |
| Socio | Reserva, carga acompañantes, pide equipamiento, cancela y descarga `.ics`. |
| Administrador | Opera reservas, check-in/out, equipos, incidentes e inventario. |
| Director | Sólo lectura: tablero, reportes y auditoría. |

## Stack y estructura

- Monorepo con npm workspaces.
- `apps/api`: NestJS 12 + Fastify 5, prefijo `/api/v1`, Swagger en `/api/docs`.
- `apps/web`: Next.js 16 (App Router) + React 19 + Tailwind 4.
- Persistencia: JSON transaccional en `apps/api/data/` (fuera de Git). Un solo nodo.
- `tools/floorplan`: genera el manifiesto del plano desde `mapa.drawio.svg`.
- `deploy/`: configuración del reverse proxy.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm install` | Instalar dependencias. |
| `npm run dev` | API en `:4000` y web en `:3000`. |
| `npm run dev:api` / `npm run dev:web` | Levantar un solo servicio. |
| `npm run floorplan` | Regenerar el manifiesto del plano. |
| `npm run typecheck` | Chequeo de tipos de API y web. |
| `npm run build` | Floorplan + build de API y web. |

## Reglas críticas

1. **Next.js 16**: antes de tocar `apps/web`, leé `apps/web/AGENTS.md` y la guía
   correspondiente en `node_modules/next/dist/docs/`. Esta versión tiene cambios
   incompatibles con versiones anteriores.
2. **Archivos generados**: no editar a mano
   `apps/api/src/floorplan/floorplan.generated.json` ni
   `apps/web/src/lib/floorplan.generated.json`. Si cambia el plano, ejecutá
   `npm run floorplan` y recompilá.
3. **Datos y secretos**: nunca commitear `.env`, `apps/api/data/` ni claves
   (`JWT_SECRET`, `PERSONAL_DATA_KEY`). Los respaldos contienen datos personales
   cifrados.
4. **Persistencia**: el almacenamiento JSON no admite varias instancias de la API
   escribiendo en paralelo. No agregar escritura concurrente sin rediseñar.
5. **Contrato de API**: errores `application/problem+json` con `code` estable;
   validación estricta (`whitelist`, `transform`); autorización por rol.
6. **Idioma**: documentación, UI y mensajes en español rioplatense. Identificadores,
   tipos y nombres de archivos en inglés.

## Flujo de trabajo

1. Tomá un ítem en estado **Listo** de [`documentos/BACKLOG.md`](documentos/BACKLOG.md).
2. Pasalo a **En curso** y anotá la fecha.
3. Implementá respetando los criterios de aceptación de su ficha.
4. Verificá con `npm run typecheck` y `npm run build`; sumá la prueba manual del rol afectado.
5. Pasalo a **En revisión** y pedí revisión.
6. Al cerrar: estado **Hecho** en el backlog y una entrada nueva en
   [`documentos/HISTORIAL.md`](documentos/HISTORIAL.md) con commit y verificación.
7. Si cambia el comportamiento visible, actualizá `README.md`.

La agenda semanal vive en [`documentos/AGENDA.md`](documentos/AGENDA.md).
WIP máximo: 2 ítems en curso.

## Git

- Ramas: `fix/BUG-01-descripcion`, `feat/REQ-02-descripcion`, `chore/TEC-01-descripcion`.
- Commits: Conventional Commits con el ID del ítem al final.
  - `fix(web): mantener foco en datos de acompañantes (BUG-01)`
  - `chore(infra): ignorar datos persistidos (TEC-01)`
- No mezclar refactors ajenos al ítem en el mismo commit.

## Definición de listo (DoR)

- Título y objetivo claros; área y prioridad asignadas.
- Bug: pasos para reproducir y comparación esperado vs. actual.
- Requerimiento: criterios de aceptación verificables.
- Estimación S/M/L y dependencias identificadas.

## Definición de terminado (DoD)

- [ ] Criterios de aceptación cumplidos.
- [ ] `npm run typecheck` y `npm run build` pasan.
- [ ] Prueba manual del rol afectado realizada.
- [ ] Documentación actualizada (README, ficha o ADR si corresponde).
- [ ] Ítem en **Hecho** y entrada en `HISTORIAL.md`.
- [ ] Sin secretos, datos personales ni archivos generados en el commit.

## Documentación

| Dónde | Qué |
| --- | --- |
| `README.md` | Visión general, puesta en marcha, despliegue y API. |
| `documentos/BACKLOG.md` | Fuente de verdad de ítems y estados. |
| `documentos/AGENDA.md` | Sprints semanales y objetivos. |
| `documentos/HISTORIAL.md` | Registro cronológico de lo realizado. |
| `documentos/items/` | Fichas detalladas por ítem. |
| `documentos/decisiones/` | ADR de decisiones técnicas. |
| `documentos/plantillas/item.md` | Plantilla para nuevas fichas. |
| `deploy/nginx/` | Proxy local de desarrollo (opcional) y su guía de instalación. |
