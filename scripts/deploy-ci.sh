#!/usr/bin/env bash
set -euo pipefail
# Secrets are passed as environment variables by the protected GitHub Environment.
for key in SSH_HOST SSH_USER SSH_PORT SSH_PRIVATE_KEY SSH_KNOWN_HOSTS GHCR_USER GHCR_TOKEN APP_WRITE_TOKEN IMAGE APP_ENV APP_PORT APP_VERSION APP_URL; do
  [[ -n "${!key:-}" ]] || { echo "Configuração obrigatória ausente: $key" >&2; exit 2; }
done
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || exit 2
[[ "$SSH_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 2
[[ "$SSH_PORT" =~ ^[0-9]+$ && "$SSH_PORT" -gt 0 && "$SSH_PORT" -le 65535 ]] || exit 2
[[ "$GHCR_USER" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*$ ]] || exit 2
[[ "$IMAGE" =~ ^ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64}$ ]] || exit 2
[[ "$APP_ENV" == staging || "$APP_ENV" == production ]] || exit 2
[[ "$APP_VERSION" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$APP_PORT" =~ ^[0-9]+$ && "$APP_PORT" -gt 1024 && "$APP_PORT" -le 65535 ]] || exit 2
[[ "${BIND_ADDRESS:-127.0.0.1}" == 127.0.0.1 || "${BIND_ADDRESS}" == 0.0.0.0 ]] || exit 2
[[ "$APP_URL" =~ ^https?:// ]] || exit 2
[[ ${#APP_WRITE_TOKEN} -ge 32 ]] || { echo 'Token do operador precisa ter 32 caracteres.' >&2; exit 2; }
task_dir=$(mktemp -d)
trap 'rm -rf -- "$task_dir"' EXIT
umask 077
printf '%s\n' "$SSH_PRIVATE_KEY" > "$task_dir/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$task_dir/known_hosts"
ssh_options=(-i "$task_dir/key" -o "UserKnownHostsFile=$task_dir/known_hosts" -o StrictHostKeyChecking=yes -o BatchMode=yes)
target="$SSH_USER@$SSH_HOST"
# Verify host key against a value collected through a trusted channel, never ssh-keyscan here.
remote_dir=$(ssh "${ssh_options[@]}" -p "$SSH_PORT" "$target" 'mktemp -d /tmp/ecohospital-deploy.XXXXXXXX')
[[ "$remote_dir" =~ ^/tmp/ecohospital-deploy\.[a-zA-Z0-9]+$ ]] || exit 2
tar -czf "$task_dir/release.tgz" deploy/compose.yml scripts/deploy-remote.sh
scp "${ssh_options[@]}" -P "$SSH_PORT" "$task_dir/release.tgz" "$target:$remote_dir/release.tgz"
# Token travels over stdin encrypted by SSH; it is never a command-line argument.
printf '%s' "$GHCR_TOKEN" | ssh "${ssh_options[@]}" -p "$SSH_PORT" "$target" \
  "docker login ghcr.io -u '$GHCR_USER' --password-stdin"
# Operador via arquivo 0600 no servidor, nunca em argumento ou na imagem.
printf '%s' "$APP_WRITE_TOKEN" | ssh "${ssh_options[@]}" -p "$SSH_PORT" "$target" \
  "umask 077; mkdir -p '/opt/ecohospital/$APP_ENV'; cat > '/opt/ecohospital/$APP_ENV/operator_token.txt'"
ssh "${ssh_options[@]}" -p "$SSH_PORT" "$target" \
  "cd '$remote_dir' && tar -xzf release.tgz && bash scripts/deploy-remote.sh '$APP_ENV' '$IMAGE' '$APP_VERSION' '$APP_PORT' '${BIND_ADDRESS:-127.0.0.1}'"
mkdir -p evidence
curl --fail --silent --show-error --retry 5 --retry-delay 5 --retry-all-errors \
  "${APP_URL%/}/health" > "evidence/$APP_ENV-health.json"
python3 - "evidence/$APP_ENV-health.json" "$APP_ENV" "$APP_VERSION" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as file:
    health = json.load(file)
assert health['status'] == 'UP', health
assert health['environment'] == sys.argv[2], health
assert health['version'] == sys.argv[3], health
print(json.dumps(health))
PY
