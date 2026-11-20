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
