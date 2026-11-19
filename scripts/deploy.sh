#!/usr/bin/env bash
# Выкатка на сервер. Запускается GitHub Actions по SSH: ключ Actions в
# authorized_keys привязан к этому скрипту (command=...) и ничего другого
# на сервере выполнить не может. Вручную: scripts/deploy.sh [sha].
#
# Тело — в функции main и вызывается последней строкой: скрипт сам
# обновляется через git reset, а bash дочитывает файл по ходу выполнения.
set -euo pipefail

APP_DIR=${APP_DIR:-/root/evodash}
KEEP_BACKUPS=5
HEALTH_TIMEOUT=600
BUILD_TIMEOUT=1200

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }

backend_health() {
  local id
  id=$(docker compose ps -q backend 2>/dev/null || true)
  [ -n "$id" ] || { echo missing; return; }
  docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo missing
}

backup_db() {
  if [ "$(backend_health)" = missing ]; then
    log "Бэкенд не запущен — бэкап пропущен"
    return
  fi
  local name="evodash.db.bak-deploy-$(date +%F-%H%M%S)"
  docker compose exec -T backend python -c "
import sqlite3
src = sqlite3.connect('/app/backend/data/evodash.db')
dst = sqlite3.connect('/app/backend/data/$name')
src.backup(dst)
dst.close()
src.close()
"
  log "Бэкап базы: backend/data/$name"
  # Хранятся только последние бэкапы выкаток; ручные бэкапы не трогаются.
  ls -1t backend/data/evodash.db.bak-deploy-* 2>/dev/null \
    | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f --
}

build_images() {
  # Сессия buildkit иногда обрывается, и сборка висит без конца —
  # ограничиваем по времени и пробуем ещё раз.
  local attempt
  for attempt in 1 2; do
    if timeout "$BUILD_TIMEOUT" docker compose build; then
      return 0
    fi
    log "Сборка не удалась (попытка $attempt)"
  done
  return 1
}

build_and_wait() {
  # Вызывается из «if !», где set -e не действует, — ошибки проверяем явно.
  build_images || return 1
  docker compose up -d --no-build --remove-orphans || return 1
  local waited=0 status
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    status=$(backend_health)
    if [ "$status" = healthy ]; then
      log "Бэкенд здоров"
      return 0
    fi
    sleep 10
    waited=$((waited + 10))
  done
  log "Бэкенд не стал здоровым за ${HEALTH_TIMEOUT} с (статус: $status)"
  docker compose logs --tail 80 backend || true
  return 1
}

main() {
  cd "$APP_DIR"
  exec 9>/tmp/evodash-deploy.lock
  flock -n 9 || { log "Выкатка уже идёт"; exit 1; }

  # Через SSH приходит только sha коммита; всё остальное игнорируется.
  local requested="${SSH_ORIGINAL_COMMAND:-${1:-}}" target=origin/main
  if [[ "$requested" =~ ^[0-9a-f]{40}$ ]]; then
    target="$requested"
  fi

  local previous
  previous=$(git rev-parse HEAD)
  git fetch -q origin
  git merge-base --is-ancestor "$target" origin/main \
    || { log "Коммит $target не входит в origin/main"; exit 1; }
  log "Выкатка $(git rev-parse --short "$target") (было $(git rev-parse --short "$previous"))"

  backup_db
  # База, загрузки и .env не в git, reset их не трогает.
  git reset -q --hard "$target"

  if ! build_and_wait; then
    log "Откат на $(git rev-parse --short "$previous")"
    git reset -q --hard "$previous"
    build_and_wait || log "Откат тоже не поднялся — нужна ручная проверка"
    exit 1
  fi

  docker builder prune -f >/dev/null
  docker image prune -f >/dev/null
  log "Готово: $(git log -1 --format='%h %s')"
}

main "$@"
exit
