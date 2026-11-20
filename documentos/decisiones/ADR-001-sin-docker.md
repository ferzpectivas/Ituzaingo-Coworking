# ADR-001 · Despliegue en VPS sin Docker

- **Estado:** Propuesto
- **Fecha:** 2026-11-20
- **Decisores:** responsable del proyecto
- **Ítems relacionados:** REQ-01, TEC-02, TEC-03

## Contexto

El despliegue actual usa Docker Compose con tres servicios: API (NestJS),
web (Next.js) y Caddy como reverse proxy con TLS automático. El requerimiento
REQ-01 pide eliminar Docker y desplegar directamente en un VPS Linux.

La aplicación es de un solo nodo, con persistencia en archivos JSON y sin base de
datos externa. El tráfico es bajo y el equipo es reducido, así que la solución
debe priorizar simplicidad operativa, backups confiables y bajo mantenimiento.

## Opciones evaluadas

| Opción | Ventajas | Desventajas |
| --- | --- | --- |
| **Caddy binario + systemd** | TLS automático, configuración mínima, misma semántica que hoy. | Un binario más que instalar y actualizar. |
| **nginx + certbot** | Muy extendido, paquetes del sistema, control fino. | Más configuración y renovación a cargo de certbot. |
| **Node con PM2 + proxy** | Simple para procesos Node. | PM2 agrega una capa extra; el arranque no queda en systemd. |

## Decisión

**Pendiente para producción.** El 2026-11-20 se definió usar **nginx** para el
desarrollo local; la alternativa para el VPS se decide antes de implementar
REQ-01. La recomendación preliminar sigue siendo **Caddy binario + systemd** por
el TLS automático y la menor cantidad de piezas.

## Consecuencias

- Se eliminan `Dockerfile`, `docker-compose.yml` y el servicio Caddy en contenedor.
- La API y la web pasan a ser units de `systemd` con reinicio automático.
- Las variables de entorno se guardan fuera del repositorio, por ejemplo en
  `/etc/ituzaingo/ituzaingo.env` con permisos restringidos.
- Los logs van a `journald`.
- Los backups se programan con `cron` o un timer de `systemd`.
- La actualización requiere `git pull`, `npm ci`, `npm run build` y
  `systemctl restart`.

## Plan de migración

1. Provisionar el VPS: usuario de servicio, Node.js 24, proxy y directorios.
2. Copiar el proyecto y crear el archivo de entorno en `/etc/ituzaingo/`.
3. Compilar (`npm run floorplan`, API y web) y crear las units de `systemd`.
4. Configurar el proxy y el TLS.
5. Detener Docker, copiar `apps/api/data/` y arrancar los servicios nuevos.
6. Verificar healthcheck, login, reserva, backups y reinicio del VPS.
7. Mantener Docker detenido (no desinstalado) durante una semana.

## Rollback

Si falla la verificación: detener las units nuevas, restaurar el backup de datos
si hubo escrituras y volver a `docker compose up -d`. No eliminar el volumen ni
los archivos de Docker hasta cerrar la ventana de observación.

## Referencias

- [`../items/REQ-01.md`](../items/REQ-01.md)
- `README.md` (sección de despliegue, a actualizar en TEC-02)
