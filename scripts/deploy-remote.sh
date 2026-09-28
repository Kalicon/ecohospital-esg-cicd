#!/usr/bin/env bash
set -euo pipefail
# Executado no servidor Linux pelo workflow. Não recebe senhas nos argumentos.
environment=${1:?environment}
image=${2:?digest reference}
version=${3:?commit SHA}
port=${4:?host port}
bind=${5:-127.0.0.1}
[[ "$environment" == staging || "$environment" == production ]] || exit 2
[[ "$image" =~ ^ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64}$ ]] || exit 2
[[ "$version" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$port" =~ ^[0-9]+$ && "$port" -gt 1024 && "$port" -le 65535 ]] || exit 2
[[ "$bind" == 127.0.0.1 || "$bind" == 0.0.0.0 ]] || exit 2
command -v docker >/dev/null
command -v python3 >/dev/null
docker compose version
release_dir="/opt/ecohospital/$environment"
mkdir -p "$release_dir"
cp deploy/compose.yml "$release_dir/compose.yml"
cd "$release_dir"
export COMPOSE_PROJECT_NAME="ecohospital-$environment"
export IMAGE="$image" APP_ENV="$environment" APP_PORT="$port" BIND_ADDRESS="$bind"
# Previous digest is kept for a documented manual rollback, without touching the volume.
if [[ -f image.txt ]]; then cp image.txt previous-image.txt; fi
umask 077
printf 'COMPOSE_PROJECT_NAME=%s\nIMAGE=%s\nAPP_ENV=%s\nAPP_PORT=%s\nBIND_ADDRESS=%s\n' \
  "$COMPOSE_PROJECT_NAME" "$IMAGE" "$APP_ENV" "$APP_PORT" "$BIND_ADDRESS" > .env
docker compose -f compose.yml pull
docker compose -f compose.yml up --detach --no-build --wait --wait-timeout 180
docker compose -f compose.yml exec -T app curl --fail --silent http://localhost:8080/health > health.json
python3 - "$environment" "$version" <<'PY'
import json, sys
with open('health.json', encoding='utf-8') as file:
    health = json.load(file)
assert health['status'] == 'UP', health
assert health['environment'] == sys.argv[1], health
assert health['version'] == sys.argv[2], health
print(json.dumps(health))
PY
printf '%s\n' "$image" > image.txt
docker compose -f compose.yml ps
