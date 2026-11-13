#!/usr/bin/env bash
#
# Runs `nginx -t` on the repository's nginx.conf with the nginx that is installed on this machine, set up the way the
# production server has it (shared/docs/DEPLOYMENT.md, shared/docs/DISASTER-RECOVERY.md): the file is the site
# /etc/nginx/sites-available/murphys-laws, enabled through sites-enabled, with the stock default site removed, next to
# the distribution's nginx and the brotli_static module. The "nginx config" job of .github/workflows/lockfile-sync.yml
# runs it in an ubuntu:24.04 container (the server's distribution, nginx 1.24) after installing nginx,
# libnginx-mod-http-brotli-static and openssl, so a file that nginx 1.24 with that module rejects (an unknown directive,
# a syntax error, a directive of a module the image does not install) fails the required lockfile-sync check before it
# can be merged and deployed. Whether the production server has the brotli package is not checked here.
#
# To run it by hand without touching a server:
#   docker run --rm -v "$PWD":/repo -w /repo ubuntu:24.04 bash -c \
#     'apt-get update -qq && apt-get install -y -qq nginx libnginx-mod-http-brotli-static openssl && bash scripts/check-nginx-config.sh'
#
# It writes under /etc/nginx and /etc/letsencrypt, so it must run as root on a throwaway machine, never on a server
# (NGINX_ETC_DIR and LETSENCRYPT_DIR redirect both, which the tests of this script use). It refuses to run when
# a certificate or the site file is already there, because it would overwrite them (CHECK_NGINX_ALLOW_OVERWRITE=1 lifts
# that, for a disposable machine that was set up before).
#
# The certificate, the key and the Diffie-Hellman parameters that nginx.conf points at are throwaway stand-ins: the
# real ones come from Certbot on the server. options-ssl-nginx.conf is a copy of Certbot's file, so the directives in
# it are tested by the same nginx too. nginx -t only reads these files, it never serves a request.
#
# Usage: check-nginx-config.sh [path-to-nginx.conf]   (default: nginx.conf in the current directory)

set -euo pipefail

conf="${1:-nginx.conf}"
etc="${NGINX_ETC_DIR:-/etc/nginx}"
letsencrypt="${LETSENCRYPT_DIR:-/etc/letsencrypt}"
live="$letsencrypt/live/murphys-laws.com"

if [ ! -f "$conf" ]; then
  echo "::error::$conf does not exist" >&2
  exit 1
fi
if ! command -v nginx > /dev/null; then
  echo "::error::nginx is not installed" >&2
  exit 1
fi
if ! command -v openssl > /dev/null; then
  echo "::error::openssl is not installed" >&2
  exit 1
fi

if [ -e "$live/fullchain.pem" ] || [ -e "$live/privkey.pem" ] || [ -e "$etc/sites-available/murphys-laws" ]; then
  if [ "${CHECK_NGINX_ALLOW_OVERWRITE:-}" != 1 ]; then
    echo "::error::$live or $etc/sites-available/murphys-laws already exists; this script replaces them with throwaway files, so it never runs on a server (set CHECK_NGINX_ALLOW_OVERWRITE=1 on a disposable machine)" >&2
    exit 1
  fi
fi

nginx -v
# The module package drops its load_module line here; without it nginx.conf's brotli_static is an unknown directive.
if ! ls "$etc"/modules-enabled/*brotli-static*.conf > /dev/null 2>&1; then
  echo "::error::the brotli_static module is not installed (libnginx-mod-http-brotli-static); the server needs it too" >&2
  exit 1
fi

mkdir -p "$live"
openssl_log="$(mktemp)"
if ! openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=murphys-laws.com" \
  -keyout "$live/privkey.pem" -out "$live/fullchain.pem" 2> "$openssl_log"; then
  cat "$openssl_log" >&2
  echo "::error::openssl could not make the throwaway certificate" >&2
  exit 1
fi
rm -f "$openssl_log"
# The named group Certbot ships (RFC 7919 ffdhe2048), without the minutes that a generated one takes.
openssl genpkey -genparam -algorithm DH -pkeyopt dh_param:ffdhe2048 -out "$letsencrypt/ssl-dhparams.pem"

cat > "$letsencrypt/options-ssl-nginx.conf" << 'OPTIONS'
# This file contains important security parameters. If you modify this file
# manually, Certbot will be unable to automatically provide future security
# updates. Instead, Certbot will print and log an error message with a path to
# the up-to-date file that you will need to refer to when manually updating
# this file. Contents are based on https://ssl-config.mozilla.org

ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;

ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
OPTIONS

mkdir -p "$etc/sites-available" "$etc/sites-enabled"
rm -f "$etc/sites-enabled/default"
cp "$conf" "$etc/sites-available/murphys-laws"
ln -sf "$etc/sites-available/murphys-laws" "$etc/sites-enabled/murphys-laws"

echo "Testing $conf as $etc/sites-available/murphys-laws"
nginx -t
