# REQ-01 · Quitar Docker del despliegue

- **Tipo:** requerimiento
- **Estado:** Refinado
- **Prioridad:** P2
- **Área:** infraestructura
- **Estimación:** L
- **Sprint:** Semana 2 (30 nov al 4 dic 2026)
- **Reportado:** 2026-11-20

## Objetivo

Desplegar la aplicación en un VPS Linux sin Docker, manteniendo TLS, reinicio
automático, logs, backups y el mismo contrato de la aplicación.

## Alcance

### Incluido

- Reemplazar Caddy en contenedor por un proxy nativo.
- Ejecutar API y web como servicios de `systemd`.
- Compilar y publicar con un script reproducible.
- Programar backups y probar la restauración.
- Documentar instalación, actualización y rollback.

### Excluido

- Cambios funcionales de la aplicación.
- Migración de la persistencia JSON a una base de datos.
- Alta disponibilidad o múltiples nodos.

## Dependencias

- TEC-03: ADR con la decisión de proxy, TLS, units y backups.
- Acceso al VPS y a la configuración DNS.

## Subtareas

- [ ] Decidir proxy y TLS según el ADR.
- [ ] Crear usuario de servicio sin privilegios y directorio de la aplicación.
- [ ] Instalar Node.js 24 y dependencias de producción.
- [ ] Crear `ituzaingo-api.service` y `ituzaingo-web.service`.
- [ ] Configurar variables de entorno fuera del repositorio (`/etc/ituzaingo/`).
- [ ] Configurar el proxy para `/api/*` → `127.0.0.1:4000` y `/*` → `127.0.0.1:3000`.
- [ ] Configurar TLS y renovación automática.
- [ ] Configurar logs en `journald` y rotación.
- [ ] Programar backup diario de `apps/api/data/` y verificar restauración.
- [ ] Configurar healthcheck y monitoreo básico.
- [ ] Ejecutar la migración en una ventana acordada.
- [ ] Actualizar `README.md` (TEC-02) y retirar `docker-compose.yml`/`Dockerfile`
      cuando la migración esté validada.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Indisponibilidad durante la migración | Ventana acordada y rollback listo. |
| Pérdida de datos | Backup previo y restauración probada. |
| TLS mal configurado | Validar con `curl` y navegador antes de publicar. |
| Reinicio no automático | Probar `systemctl restart` y reinicio del VPS. |
| Variables o secretos mal ubicados | Revisar permisos de `/etc/ituzaingo/`. |

## Rollback

Conservar el `docker-compose.yml`, el volumen de datos y el certificado hasta
completar una semana de operación estable. Si falla la migración: detener los
servicios nuevos, restaurar el backup si corresponde y volver a levantar Docker
Compose.

## Criterios de aceptación

- [ ] `GET /api/v1/health` responde correctamente a través del proxy.
- [ ] Login y reserva completa funcionan para los tres roles.
- [ ] El certificado TLS es válido y se renueva automáticamente.
- [ ] API y web se reinician solos tras un reboot del VPS.
- [ ] El backup diario se genera y una restauración de prueba es exitosa.
- [ ] Los logs quedan disponibles en `journald`.
- [ ] `README.md` describe el nuevo despliegue.

## Historial del ítem

| Fecha | Estado | Nota |
| --- | --- | --- |
| 2026-11-20 | Nuevo | Relevado por el usuario. |
| 2026-11-20 | Refinado | Se desglosó en subtareas y se vinculó a TEC-03. |
