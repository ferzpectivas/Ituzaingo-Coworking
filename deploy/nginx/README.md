# nginx local

Proxy de desarrollo para probar el mismo esquema que producción: un solo origen,
la web en `/` y la API en `/api/v1`.

```
http://localhost/          -> Next.js (127.0.0.1:3000)
http://localhost/api/v1/*  -> API NestJS (127.0.0.1:4000)
```

## Requisitos

- nginx instalado:

  ```bash
  sudo apt update
  sudo apt install -y nginx
  ```

- API y web corriendo:

  ```bash
  npm run dev
  ```

## Instalación

```bash
./deploy/nginx/install-local.sh
```

El script copia `local.conf` a `/etc/nginx/sites-available/`, lo enlaza en
`sites-enabled/`, desactiva el sitio `default`, valida con `nginx -t` y recarga el
servicio.

> Se copia el archivo en lugar de enlazarlo al repositorio porque `/home/fherz`
> no es accesible para el usuario `www-data`.

## Variables de entorno

En `.env`:

```env
WEB_ORIGIN=http://localhost
NEXT_PUBLIC_API_URL=/api/v1
COOKIE_SECURE=false
```

`NEXT_PUBLIC_API_URL` se incorpora al bundle: reiniciar `npm run dev` después de
cambiarla.

## Verificación

```bash
curl -I http://localhost
curl -s http://localhost/api/v1/health
```

También conviene abrir el mapa en dos pestañas y confirmar que la ocupación se
actualiza por SSE sin recargar.

## Problemas frecuentes

### `502 Bad Gateway`

La API o la web no están escuchando. Verificar:

```bash
ss -ltnp | grep -E ':(3000|4000)\b'
npm run dev
```

### `500` en `POST /api/v1/auth/login`

Hablá directo con la API para descartar nginx:

```bash
curl -i -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -H 'Origin: http://localhost' \
  -d '{"email":"socio@coworking.gob.ar","password":"Socio1234!"}'
```

Si también falla, probablemente quedó una instancia vieja ocupando el puerto
`4000` (por ejemplo, un `npm run start` anterior). Identificá y cerrá el proceso:

```bash
ss -ltnp | grep ':4000'
kill <pid>
npm run dev
```

`npm run dev` ejecuta `tools/dev/check-ports.mjs` antes de arrancar y avisa si
`3000` o `4000` ya están en uso.

### El watcher de la API se cae después de un build

No ejecutes `npm run build` mientras `npm run dev` está corriendo: el build
reescribe `apps/api/dist` y el watcher puede reiniciar en un estado intermedio
(`MODULE_NOT_FOUND`). Detené el dev, compilá y volvé a levantarlo.

## Volver al modo directo

Si querés acceder sin nginx a `http://localhost:3000`:

```env
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Y desactivar el sitio:

```bash
sudo rm -f /etc/nginx/sites-enabled/ituzaingo-coworking
sudo ln -sfn /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo systemctl reload nginx
```
