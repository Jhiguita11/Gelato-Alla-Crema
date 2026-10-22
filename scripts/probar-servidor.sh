#!/usr/bin/env bash
# Prueba la migración y src/sync/remoto.js contra un servidor de verdad, sin
# tocar el proyecto de Supabase: levanta un Postgres desechable con lo mínimo
# de Supabase (roles, auth.jwt, publicación), aplica la migración, pone
# PostgREST adelante y corre src/__tests__/integracion.test.js.
#
# Necesita: Postgres 15+ (initdb/pg_ctl en el PATH o en PG_BIN), el binario
# `postgrest` (https://github.com/PostgREST/postgrest/releases) y node.
#   PG_BIN=/usr/lib/postgresql/16/bin POSTGREST=./postgrest scripts/probar-servidor.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN=${PG_BIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}
POSTGREST=${POSTGREST:-postgrest}
TMP=$(mktemp -d)
PG_PORT=${PG_PORT:-55432}
REST_PORT=${REST_PORT:-55433}
PROXY_PORT=${PROXY_PORT:-54399} # 54321 es el de `supabase start`: se evita a propósito
SECRETO=$(head -c 48 /dev/urandom | base64 | tr -d '\n/+=' | head -c 48)

limpiar() {
  [[ -n "${PID_PROXY:-}" ]] && kill "$PID_PROXY" 2>/dev/null || true
  [[ -n "${PID_REST:-}" ]] && kill "$PID_REST" 2>/dev/null || true
  correr "$PG_BIN/pg_ctl -D $TMP/db stop -m fast" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}

# Postgres corre como usuario sin privilegios (initdb no acepta root).
CORRER=()
if [[ $(id -u) == 0 ]]; then chown -R postgres "$TMP"; CORRER=(su postgres -c); fi
correr() { if [[ ${#CORRER[@]} -gt 0 ]]; then "${CORRER[@]}" "$*"; else bash -c "$*"; fi; }
trap limpiar EXIT

correr "$PG_BIN/initdb -D $TMP/db -A trust -U postgres >/dev/null"
correr "$PG_BIN/pg_ctl -D $TMP/db -o '-p $PG_PORT -k $TMP' -l $TMP/pg.log start >/dev/null"
sleep 1
PSQL=(psql -h "$TMP" -p "$PG_PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
set client_min_messages = error;
create publication supabase_realtime;
SQL
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
echo "✓ migración aplicada"

cat > "$TMP/rest.conf" <<CONF
db-uri = "postgres://postgres@localhost:$PG_PORT/postgres?host=$TMP"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRETO"
server-port = $REST_PORT
CONF
"$POSTGREST" "$TMP/rest.conf" >"$TMP/rest.log" 2>&1 &
PID_REST=$!

# supabase-js habla con /rest/v1/…; PostgREST sirve en la raíz.
node -e "
const http = require('http');
http.createServer((req, res) => {
  const p = http.request({ host: '127.0.0.1', port: $REST_PORT, method: req.method,
    path: req.url.replace(/^\/rest\/v1/, ''), headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  p.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(p);
}).listen($PROXY_PORT);
" &
PID_PROXY=$!
sleep 1.5

# token <email> [rol]: como los de Supabase, con app_metadata.rol si se da.
token() {
  node -e "
const c = require('crypto');
const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const cuerpo = b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ role: 'authenticated', email: '$1', app_metadata: '${2:-}' ? { rol: '${2:-}' } : {}, exp: Math.floor(Date.now()/1000) + 3600 });
console.log(cuerpo + '.' + c.createHmac('sha256', '$SECRETO').update(cuerpo).digest('base64url'));
"
}

GAC_REST_URL="http://localhost:$PROXY_PORT" \
GAC_TOKEN_LOCAL=$(token local@gelatoallacrema.app) \
GAC_TOKEN_ADMIN=$(token admin@gelatoallacrema.app admin) \
GAC_TOKEN_INTRUSO=$(token intruso@ejemplo.com) \
  npx vitest run src/__tests__/integracion.test.js
