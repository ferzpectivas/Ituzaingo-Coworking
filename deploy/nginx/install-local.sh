#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -eq 0 ]]; then
  echo "Ejecutá este script sin sudo; va a pedir la contraseña cuando haga falta." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE=ituzaingo-coworking

sudo install -m 0644 "$ROOT/deploy/nginx/local.conf" "/etc/nginx/sites-available/$SITE"
sudo ln -sfn "/etc/nginx/sites-available/$SITE" "/etc/nginx/sites-enabled/$SITE"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "Listo. Abrí http://localhost"
