# Espacio de Coworking de Ituzaingó — Plataforma de gestión y reservas

Aplicación web completa para el Espacio de Coworking municipal de Ituzaingó: mapa
arquitectónico 3D interactivo, reservas con titular y acompañantes identificados,
control de equipamiento con checklist de entrega y devolución, tablero de dirección
y auditoría inmutable.

- **API**: NestJS 12 + Fastify 5, prefijo `/api/v1`, Swagger/OpenAPI, JWT en cookies
  httpOnly, SSE para ocupación en vivo.
- **Web**: Next.js 16 (App Router) + React 19 + Tailwind 4 + React Three Fiber.
- Persistencia: archivos JSON transaccionales en disco, sin base de datos externa ni
  costos de servicio:
  - `users.json`, `persons.json`, `sessions.json` — cuentas, personas y sesiones.
  - `reservations.json`, `gear.json`, `checkouts.json` — reservas, inventario y
    asignaciones con checklists.
  - `audit.json`, `settings.json`, `idempotency.json`, `meta.json` — auditoría,
    configuración, claves de idempotencia y revisión global.
  - `journal.ndjson` y los `*.bak` — journal de recuperación y copia previa.
- **Despliegue**: un único VPS Linux con Docker Compose (API + web + Caddy).

---

## Índice

1. [Roles y alcance funcional](#roles-y-alcance-funcional)
2. [Requisitos](#requisitos)
3. [Puesta en marcha local](#puesta-en-marcha-local)
4. [Credenciales de demostración](#credenciales-de-demostración)
5. [Configuración (.env)](#configuración-env)
6. [Despliegue en producción con Docker](#despliegue-en-producción-con-docker)
7. [Datos, respaldos y recuperación](#datos-respaldos-y-recuperación)
8. [API y documentación](#api-y-documentación)
9. [Mapa arquitectónico](#mapa-arquitectónico)
10. [Verificación y pruebas](#verificación-y-pruebas)
11. [Estructura del repositorio](#estructura-del-repositorio)
12. [Decisiones de seguridad](#decisiones-de-seguridad)
13. [Limitaciones conocidas](#limitaciones-conocidas)

---

## Roles y alcance funcional

| Rol | Puede hacer |
| --- | --- |
| **Socio** | Ver el mapa y la ocupación, crear reservas (el titular es siempre su cuenta, sin retipear el DNI), cargar acompañantes con documento, pedir equipamiento, ver y cancelar sus reservas, descargar el evento `.ics`. |
| **Administrador** | Mapa completo con nombres reales, tabla operativa del día, filtros, edición de reservas, check-in / check-out / ausencias, entrega y devolución de equipos con checklist, incidentes, alta de equipos y cambio a mantenimiento. |
| **Director** | Sólo lectura: tablero de indicadores, reportes PDF/Excel/CSV, impresión y auditoría con detalle antes/después. No puede operar reservas ni equipos. |

Flujo de reserva en tres pasos: **(1)** espacio, fecha, franja y cantidad de personas;
**(2)** identificación de personas (titular + acompañantes con tipo y número de
documento); **(3)** equipamiento opcional con su accesorio obligatorio.

- Notebook → funda y cargador.
- Proyector → caja, cable HDMI, cable VGA y cable de energía.
- Pizarra desplazable → sin accesorios obligatorios.
- La **Sala de Reuniones** se reserva completa: exige los 10 asientos libres y fija
  automáticamente 10 personas.
- Horario: lunes a viernes de 08:00 a 18:00. Franjas: `manana` 08–11,
  `mediodia` 11–15 y `tarde` 15–18 (America/Argentina/Buenos_Aires).

Capacidad total: **45 puestos** — Coworking 1 con 20 (3 mesas), Aula de
Capacitaciones con 15 pupitres y Sala de Reuniones con 10. Inventario inicial:
2 notebooks, 1 proyector y 1 pizarra desplazable.

---

## Requisitos

- Node.js **24** y npm **11** (probado con Node 24.22.0 / npm 11.19.1).
- No requiere PostgreSQL, Prisma ni Redis.
- Para desplegar: Docker Engine 24+ y el plugin Docker Compose v2.

---

## Puesta en marcha local

```bash
npm install
npm run floorplan      # regenera el manifiesto desde "mapa.drawio.svg"
npm run dev            # API en :4000 y web en :3000
```

O por separado:

```bash
npm run dev:api        # http://localhost:4000/api/v1
npm run dev:web        # http://localhost:3000
```

Compilación de producción local:

```bash
npm run build
npm run start
```

Variables mínimas para desarrollo (se pueden exportar en la terminal o copiar
`.env.example` como `.env`):

```env
API_PORT=4000
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
JWT_SECRET=cambiar-este-secreto-en-produccion
COOKIE_SECURE=false
DATA_DIR=./data
SEED_ON_START=true
```

> `NEXT_PUBLIC_API_URL` se incorpora al bundle en tiempo de compilación: si cambia,
> hay que volver a ejecutar `npm run build -w @ituzaingo/web`.

### Desarrollo detrás de nginx (opcional)

Para probar el mismo esquema de producción (un solo origen, `/api/*` a la API):

```bash
sudo apt update && sudo apt install -y nginx   # una sola vez
./deploy/nginx/install-local.sh
```

Ajustar `.env` y reiniciar `npm run dev`:

```env
WEB_ORIGIN=http://localhost
NEXT_PUBLIC_API_URL=/api/v1
COOKIE_SECURE=false
```

Luego abrir `http://localhost`. La configuración, verificación y rollback están
en [`deploy/nginx/README.md`](deploy/nginx/README.md).

Para regenerar los datos demo: detener la API, borrar la carpeta `data/` y volver a
iniciar con `SEED_ON_START=true`.

---

## Credenciales de demostración

| Rol | Email | Contraseña |
| --- | --- | --- |
| Socio | `socio@coworking.gob.ar` | `Socio1234!` |
| Administrador | `admin@coworking.gob.ar` | `Admin1234!` |
| Director | `director@coworking.gob.ar` | `Director1234!` |

En producción, cambiarlas desde **Mi cuenta → Seguridad de la cuenta** antes de
publicar el sitio, y luego poner `SEED_ON_START=false`.

---

## Configuración (.env)

| Variable | Descripción | Valor sugerido |
| --- | --- | --- |
| `API_PORT` | Puerto interno de la API | `4000` |
| `WEB_ORIGIN` | Origen permitido para CORS (admite lista separada por comas) | `https://coworking.ituzaingo.gob.ar` |
| `NEXT_PUBLIC_API_URL` | URL de la API que usa el navegador | `/api/v1` detrás de Caddy |
| `API_ORIGIN` | Origen de la API para el rewrite de Next (sólo Render/PaaS) | `https://ituzaingo-coworking-api.onrender.com` |
| `JWT_SECRET` | Clave de firma de los JWT (obligatoria en producción) | 48 bytes aleatorios |
| `PERSONAL_DATA_KEY` | Clave AES-256-GCM para documentos personales | aleatoria y estable |
| `COOKIE_SECURE` | Cookies sólo por HTTPS | `true` en producción |
| `DATA_DIR` | Carpeta de persistencia JSON | `/data` en Docker |
| `SEED_ON_START` | Genera datos demo si no existen | `true` sólo la primera vez |

Generar secretos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **Importante**: si cambia `JWT_SECRET` o `PERSONAL_DATA_KEY` con datos ya cargados,
> los documentos cifrados existentes dejan de poder descifrarse. Definirlas antes del
> primer arranque y conservarlas con los respaldos.

---

## Despliegue en producción con Docker

1. Copiar el proyecto al servidor y crear el archivo de entorno:

   ```bash
   cp .env.production.example .env
   # completar DOMAIN, WEB_ORIGIN, JWT_SECRET y PERSONAL_DATA_KEY
   ```

2. Compilar y levantar:

   ```bash
   docker compose build
   docker compose up -d
   docker compose ps
   ```

3. Verificar:

   ```bash
   curl -fsS http://localhost/api/v1/health
   docker compose logs -f api
   ```

Arquitectura de contenedores:

```
Internet → Caddy (:80/:443)
             ├── /api/*  → api:4000   (NestJS + datos en volumen /data)
             └── /*      → web:3000   (Next.js)
```

- Con `DOMAIN=coworking.ituzaingo.gob.ar` Caddy gestiona el certificado TLS
  automáticamente (hace falta DNS apuntando al VPS y los puertos 80/443 abiertos).
- Para una prueba rápida por IP: `DOMAIN=:80` y `COOKIE_SECURE=false`.
- La API no publica el puerto 4000 al exterior: sólo Caddy la alcanza.
- El estado vive en el volumen `coworking-data` montado en `/data`.

Primer arranque y endurecimiento:

```bash
# 1) con SEED_ON_START=true se crean usuarios y datos demo
docker compose up -d
# 2) ingresar con cada rol demo y cambiar la contraseña desde "Mi cuenta"
# 3) desactivar la semilla y recrear el contenedor
#    SEED_ON_START=false en .env
docker compose up -d --force-recreate api
```

Actualizaciones:

```bash
git pull            # o copiar la nueva versión
docker compose build
docker compose up -d
```

---

## Despliegue en Render

Render publica la web y la API como dos servicios separados y no hay un proxy
delante: sin más, `/api/*` lo resuelve Next.js y el login devuelve 404. La
solución es un rewrite de `next.config.ts` activado con la variable
`API_ORIGIN`:

```
Internet → https://ituzaingo-coworking.onrender.com   (Next.js)
              └── /api/*  →  rewrite  →  https://ituzaingo-coworking-api.onrender.com  (NestJS)
```

Pasos:

1. Crear el servicio de API desde el Blueprint del repositorio
   (`render.yaml`): **New → Blueprint** y elegir el repositorio. Al sincronizar,
   completar `JWT_SECRET` y `PERSONAL_DATA_KEY` (son `sync: false`). Usar la
   misma región que el servicio web.
2. En el servicio **web**, agregar
   `API_ORIGIN=https://ituzaingo-coworking-api.onrender.com` y verificar que
   `NEXT_PUBLIC_API_URL=/api/v1` esté definida.
3. Redeployar la web. Next 16 hornea los rewrites en `routes-manifest.json` al
   compilar: si `API_ORIGIN` se agregó después del último build, hay que hacer
   **Clear build cache & deploy** para que el rewrite exista.

Verificación:

```bash
curl -fsS https://ituzaingo-coworking.onrender.com/api/v1/health
# 200 con JSON de la API (no el 404 HTML de Next)

curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://ituzaingo-coworking.onrender.com/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"socio@coworking.gob.ar","password":"Socio1234!"}'
# 201 con Set-Cookie; un 404 indica que falta API_ORIGIN o no hubo rebuild
```

Notas:

- La API escucha en `PORT` (lo inyecta Render); `API_PORT` sigue teniendo
  prioridad en Docker Compose y en el desarrollo local.
- El disco de Render es efímero: con `SEED_ON_START=true` los datos demo se
  regeneran en cada arranque o redeploy. Para conservar datos reales hace falta
  un disco persistente (plan pago) o el despliegue en VPS de REQ-01.
- La API queda expuesta públicamente, pero todas las rutas de negocio exigen
  sesión (cookies del dominio de la web) y CORS sólo acepta `WEB_ORIGIN`.
- En el plan gratuito los servicios se duermen con la inactividad: el primer
  request tarda unos segundos.

---

## Datos, respaldos y recuperación

- Persistencia: `data/` con colecciones separadas (`users.json`, `persons.json`,
  `reservations.json`, `gear.json`, `checkouts.json`, `sessions.json`, `settings.json`,
  `audit.json`, `idempotency.json`, `meta.json`) más `journal.ndjson` y los `*.bak`.
- Cada escritura es transaccional: se serializa el estado completo, se escribe en un
  archivo temporal y se reemplaza de forma atómica (`fsync` + `rename`), con
  `*.bak` de la versión anterior, journal de operaciones y recuperación al iniciar.
- Hay un mutex global: no se producen escrituras concurrentes parciales.
- Cada cambio incrementa `meta.revision` y se publica por SSE.

Respaldo (con el contenedor en marcha o detenido):

```bash
docker compose exec api sh -c 'tar -czf - -C /data .' > coworking-$(date +%F).tar.gz
```

Restauración:

```bash
docker compose stop api
cat coworking-2026-11-18.tar.gz | docker compose run --rm -T api sh -c 'tar -xzf - -C /data'
docker compose start api
```

Los respaldos incluyen datos personales cifrados: guardarlos con acceso restringido y
conservar `JWT_SECRET` / `PERSONAL_DATA_KEY` en un gestor de secretos.

---

## API y documentación

- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs-json`
- Formato de errores: `application/problem+json` con `code` estable
  (`AUTH_REQUIRED`, `DOCUMENT_REQUIRED`, `SEAT_TAKEN`, `HOLDER_MISMATCH`, …).

| Grupo | Endpoints |
| --- | --- |
| Autenticación | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password` |
| Mapa y espacios | `GET /config`, `GET /spaces`, `GET /spaces/:code`, `GET /map/floorplan`, `GET /map/occupancy`, `GET /availability` |
| Reservas | `GET /reservations`, `POST /reservations`, `GET /reservations/:id`, `PATCH /reservations/:id`, `POST /reservations/:id/cancel`, `check-in`, `check-out`, `no-show`, `GET /reservations/:id/timeline`, `GET /reservations/:id/ics` |
| Equipamiento | `GET /equipment`, `GET /equipment/assignments`, `GET /equipment/:id`, `POST /equipment`, `PATCH /equipment/:id`, `POST /equipment/assignments/:id/deliver`, `/return`, `/incident` |
| Auditoría | `GET /audit`, `GET /audit/export.csv` |
| Reportes | `GET /reports/summary`, `GET /reports/reservations`, `GET /reports/export?format=pdf\|csv\|xlsx&type=resumen\|reservas\|ocupacion\|equipos` |
| Tiempo real | `GET /stream/occupancy?date=YYYY-MM-DD&slot=manana` (SSE con snapshot + heartbeat cada 25 s) |
| Público | `GET /public/floorplan`, `GET /public/overview`, `GET /health` |

Notas de contrato:

- Las reservas aceptan `Idempotency-Key` para evitar duplicados por reintentos.
- Para socios, el titular se resuelve desde la cuenta autenticada: el documento del
  titular es opcional en el cuerpo; los acompañantes siempre lo requieren.
- Los reportes y la auditoría sólo exponen los últimos cuatro dígitos del documento.
- El socio ve `Nombre I.` en el mapa; administración y dirección ven el nombre completo.

Ejemplo de creación (socio, sin DNI propio):

```bash
curl -s -X POST http://localhost:4000/api/v1/reservations \
  -b cookies.txt -H 'content-type: application/json' \
  -H "idempotency-key: $(uuidgen)" \
  -d '{
    "spaceCode": "coworking",
    "date": "2026-11-20",
    "slotId": "tarde",
    "partySize": 2,
    "people": [
      { "firstName": "Juan", "lastName": "Pérez", "docType": "DNI", "role": "titular" },
      { "firstName": "Ana", "lastName": "Suárez", "docType": "DNI", "docNumber": "31222333", "role": "acompanante" }
    ],
    "equipment": { "computers": 1, "projectors": 0 }
  }'
```

---

## Mapa arquitectónico

El mapa deriva de `mapa.drawio.svg`, procesado por
`tools/floorplan/build-floorplan.mjs`:

- Escala: 1 unidad SVG = 0,025 m; el origen y los límites se calculan desde la
  geometría del plano (11,2 m × 9,0 m).
- Se detectan 3 ambientes, 19 muebles, 45 asientos, 21 volúmenes de muro y
  5 aberturas (3 puertas y el ventanal del frente sur).
- Pupitres rojos → puestos individuales; mesas marrones → mesas grupales.
- El perímetro se ajusta a los rectángulos de los ambientes con una tolerancia
  de 2 unidades SVG (5 cm), porque el plano está dibujado a mano.
- Los elementos fijos del plano (pizarra del aula, puertas y ventanal) salen
  del propio dibujo; no se agrega decoración que no figure en él.
- El script escribe `apps/api/src/floorplan/floorplan.generated.json` y
  `apps/web/src/lib/floorplan.generated.json`.

Si se modifica el dibujo, ejecutar `npm run floorplan` y recompilar ambos paquetes.

---

## Verificación y pruebas

```bash
npm run typecheck      # API y web
npm run build          # floorplan + API + web
```

Pruebas manuales sugeridas por rol:

1. **Socio**: ingresar, abrir el mapa (2D/3D), reservar en Coworking con un acompañante
   sin escribir el DNI propio, ver el marcador con `+1`, cancelar y descargar el `.ics`.
2. **Administrador**: verificar la tabla del día, hacer check-in/check-out, entregar y
   devolver una computadora con checklist, marcar un accesorio faltante para generar un
   incidente, dar de alta un equipo y enviarlo a mantenimiento.
3. **Director**: abrir el tablero, cambiar el rango de fechas, exportar PDF, Excel y CSV,
   revisar la auditoría con el detalle antes/después y confirmar que no puede operar
   reservas ni equipos (403).
4. **Tiempo real**: con el mapa abierto en dos navegadores, crear o cancelar una reserva
   y verificar la actualización por SSE sin recargar.

---

## Estructura del repositorio

```
apps/
  api/                    NestJS + Fastify
    src/auth              login, refresh rotativo, permisos, cambio de contraseña
    src/reservations      disponibilidad, reservas, check-in/out, ICS
    src/equipment         inventario, asignaciones, checklists, incidentes
    src/reports           KPIs y exportaciones PDF/XLSX/CSV
    src/audit             bitácora y exportación
    src/spaces            config, espacios, mapa, ocupación, disponibilidad
    src/storage           JSON transaccional, seed, tipos
    src/stream            SSE de ocupación
  web/                    Next.js 16
    src/app               landing, ingreso, panel (mapa, reservas, operación, equipos, dirección, auditoría, cuenta)
    src/components        mapa 3D, wizard, tablas, primitivas de UI
    src/lib               cliente de API, tipos, formato
deploy/Caddyfile          reverse proxy y TLS
tools/floorplan           generador del manifiesto desde el SVG
apps/api/data/            estado persistido (fuera de Git)
```

### Documentación de trabajo

- [`AGENTS.md`](AGENTS.md): guía de trabajo para agentes y colaboradores.
- [`documentos/BACKLOG.md`](documentos/BACKLOG.md): requerimientos, bugs y deuda
  técnica, con estado, prioridad y estimación.
- [`documentos/AGENDA.md`](documentos/AGENDA.md): sprints semanales y objetivos.
- [`documentos/HISTORIAL.md`](documentos/HISTORIAL.md): registro cronológico de
  los trabajos realizados.

---

## Decisiones de seguridad

- Cookies `httpOnly` + `SameSite=Lax`; access token de 30 minutos y refresh opaco
  rotativo de 7 días con revocación en cada uso.
- Contraseñas con **scrypt** y sal aleatoria; política mínima para el cambio: 10
  caracteres con mayúscula, minúscula y número.
- Documentos personales: **AES-256-GCM** (cifrado), hash para deduplicación y sólo los
  últimos 4 dígitos en claro.
- Autorización por rol con guards de JWT y de roles; el director no ejecuta acciones
  operativas. El socio sólo accede a sus propias reservas.
- Validación estricta de entrada (`whitelist`, `transform`) y errores normalizados.
- Cabeceras de seguridad (`nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) y CORS restringido a `WEB_ORIGIN`.
- Auditoría de cada acción sensible con actor, rol, IP y diff antes/después.
- Límite de intentos y bloqueo suave de login, más registro en la bitácora.

Checklist mínimo antes de publicar:

- [ ] `JWT_SECRET` y `PERSONAL_DATA_KEY` aleatorios y respaldados.
- [ ] Contraseñas demo cambiadas y `SEED_ON_START=false`.
- [ ] `COOKIE_SECURE=true` con HTTPS activo.
- [ ] `WEB_ORIGIN` con el dominio real.
- [ ] Respaldo del volumen `coworking-data` programado (cron/tarea del sistema).
- [ ] Acceso al panel de administración restringido por red o VPN si aplica.

---

## Limitaciones conocidas

- La persistencia JSON está pensada para un único nodo: no admite varias instancias de
  la API escribiendo en paralelo.
- No hay recuperación de contraseña por email; el restablecimiento se hace desde el
  servidor con acceso a los datos.
- Los reportes se generan del estado actual (sin histórico de versiones): la auditoría
  conserva el detalle de cada cambio.
- El mapa 3D requiere WebGL; en equipos sin aceleración se puede usar la vista 2D.
