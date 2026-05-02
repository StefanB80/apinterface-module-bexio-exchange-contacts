#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SELF="$SCRIPT_DIR/deploy.sh"
LOCK_FILE="$REPO_DIR/.deploy.lock"
LOG_FILE="$REPO_DIR/.deploy.log"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/bec_repo_deploy_key}"

mkdir -p "$REPO_DIR" 2>/dev/null || true
{
  echo "[$(date -Is)] deploy.sh argv=$* user=$(id -un 2>/dev/null || echo '?') home=$HOME"
} >>"$LOG_FILE" 2>/dev/null || true

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 <tag>" >&2
  exit 64
fi

TAG="$1"
if ! [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-bec$ ]]; then
  echo "Invalid tag format: $TAG (expected vX.Y.Z-bec)." >>"$LOG_FILE" 2>/dev/null || true
  echo "Invalid tag format: $TAG (expected vX.Y.Z-bec)." >&2
  exit 65
fi

npm_install_prod() {
  local dir="$1"
  if [ ! -d "$dir" ] || [ ! -f "$dir/package.json" ]; then
    return 0
  fi
  if [ -f "$dir/package-lock.json" ]; then
    (cd "$dir" && npm ci --omit=dev)
  else
    (cd "$dir" && npm install --omit=dev)
  fi
}

sync_release_dir_from_repo() {
  local rel="$REPO_DIR/releases/$TAG"
  mkdir -p "$rel"
  echo "[$(date -Is)] SYNC_RELEASE -> $rel"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude '.git/' \
      --exclude 'node_modules/' \
      --exclude 'releases/' \
      "$REPO_DIR/" "$rel/"
  else
    (cd "$REPO_DIR" && tar cf - \
      --exclude='./.git' \
      --exclude='./node_modules' \
      --exclude='./releases' \
      .) | (cd "$rel" && tar xf -)
  fi
  npm_install_prod "$rel"
  if [ ! -d "$rel/node_modules/ews-javascript-api" ]; then
    echo "[$(date -Is)] ERROR: ews-javascript-api fehlt in $rel" >>"$LOG_FILE" 2>&1
    echo "ERROR: ews-javascript-api nicht installiert unter $rel/node_modules" >&2
    exit 69
  fi
}

if [ "${BEC_DEPLOY_PHASE:-}" = "install" ]; then
  {
    echo "[$(date -Is)] INSTALL tag=$TAG"
    cd "$REPO_DIR"
    sync_release_dir_from_repo
    # Core (moduleDiscovery) bevorzugt <module>/current/src/... — ohne diesen Link bleibt eine alte current-Version aktiv.
    rel="$REPO_DIR/releases/$TAG"
    if [ ! -f "$rel/src/moduleManifest.js" ]; then
      echo "[$(date -Is)] ERROR: Release unvollstaendig: $rel" >>"$LOG_FILE" 2>&1
      echo "ERROR: Release $rel fehlt oder hat kein src/moduleManifest.js." >&2
      exit 71
    fi
    if [ -e "$REPO_DIR/current" ] && [ ! -L "$REPO_DIR/current" ]; then
      echo "[$(date -Is)] ERROR: current ist kein Symlink: $REPO_DIR/current" >>"$LOG_FILE" 2>&1
      echo "ERROR: $REPO_DIR/current existiert als Verzeichnis/Datei — bitte umbenennen, Core erwartet Symlink -> releases/<Tag>." >&2
      exit 70
    fi
    ln -sfnT "$rel" "$REPO_DIR/current"
    echo "[$(date -Is)] CURRENT_SYMLINK $(readlink -f "$REPO_DIR/current" 2>/dev/null || readlink "$REPO_DIR/current")"
    npm_install_prod "$REPO_DIR"
    if [ -L "$REPO_DIR/current" ] || [ -d "$REPO_DIR/current" ]; then
      npm_install_prod "$(cd "$REPO_DIR/current" && pwd)"
    fi
    echo "[$(date -Is)] SUCCESS install tag=$TAG"
  } >>"$LOG_FILE" 2>&1
  echo "Deploy successful: $TAG"
  exit 0
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deployment is currently running." >&2
  exit 66
fi

{
  echo "[$(date -Is)] START deploy tag=$TAG"
  cd "$REPO_DIR"

  if [ ! -d ".git" ]; then
    echo "Not a git repository: $REPO_DIR" >&2
    exit 67
  fi

  if [ ! -f "$DEPLOY_KEY" ]; then
    echo "Missing deploy key: $DEPLOY_KEY" >&2
    exit 68
  fi

  export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes"

  git fetch --prune --tags origin
  git rev-parse -q --verify "refs/tags/$TAG" >/dev/null
  git checkout --detach "$TAG"

  echo "[$(date -Is)] CHECKOUT_OK tag=$TAG"
} >>"$LOG_FILE" 2>&1

export BEC_DEPLOY_PHASE=install
exec bash "$SELF" "$TAG"
