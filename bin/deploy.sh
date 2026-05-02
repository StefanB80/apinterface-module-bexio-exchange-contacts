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
    rel="$REPO_DIR/releases/$TAG"
    if [ ! -f "$rel/src/moduleManifest.js" ]; then
      echo "[$(date -Is)] ERROR: Release unvollstaendig: $rel" >>"$LOG_FILE" 2>&1
      echo "ERROR: Release $rel fehlt oder hat kein src/moduleManifest.js." >&2
      exit 71
    fi
    if [ -d "$REPO_DIR/current" ] && [ ! -L "$REPO_DIR/current" ]; then
      echo "[$(date -Is)] REPLACE_DIR current (war Verzeichnis)" >>"$LOG_FILE" 2>&1
      rm -rf "$REPO_DIR/current"
    fi
    if [ -e "$REPO_DIR/current" ] && [ ! -L "$REPO_DIR/current" ]; then
      echo "ERROR: $REPO_DIR/current ist eine Datei — bitte entfernen." >&2
      exit 70
    fi
    rm -f "$REPO_DIR/current"
    # Relativer Symlink: funktioniert mit allen ln-Varianten; kein -T noetig.
    (cd "$REPO_DIR" && ln -snf "releases/$TAG" current)
    echo "[$(date -Is)] CURRENT_SYMLINK $(readlink "$REPO_DIR/current" 2>/dev/null || true)"
    if [ ! -L "$REPO_DIR/current" ] || [ ! -f "$REPO_DIR/current/package.json" ]; then
      echo "ERROR: Symlink current fehlgeschlagen oder kein package.json unter current/." >&2
      echo "  readlink: $(readlink "$REPO_DIR/current" 2>/dev/null || echo '?')" >&2
      ls -la "$REPO_DIR" >&2 || true
      exit 72
    fi
    npm_install_prod "$REPO_DIR"
    if [ -L "$REPO_DIR/current" ] || [ -d "$REPO_DIR/current" ]; then
      npm_install_prod "$(cd "$REPO_DIR/current" && pwd)"
    fi
    echo "[$(date -Is)] SUCCESS install tag=$TAG"
  } >>"$LOG_FILE"

  ver="$(grep -m1 '"version"' "$REPO_DIR/current/package.json" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
  echo "Deploy successful: $TAG (current -> $(readlink "$REPO_DIR/current"), package $ver)" >&2
  exit 0
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deployment is currently running." >&2
  exit 66
fi

cd "$REPO_DIR"

if [ ! -d ".git" ]; then
  echo "Not a git repository: $REPO_DIR" >&2
  exit 67
fi

if [ ! -f "$DEPLOY_KEY" ]; then
  echo "Missing deploy key: $DEPLOY_KEY" >&2
  echo "Setze DEPLOY_KEY auf den Pfad zum Deploy-Key oder lege die Datei unter ~/.ssh/bec_repo_deploy_key ab." >&2
  exit 68
fi

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes"

set +e
{
  echo "[$(date -Is)] START deploy tag=$TAG"
  git fetch --prune --tags origin
  git rev-parse -q --verify "refs/tags/$TAG" >/dev/null
  # -f: lokale Aenderungen an getrackten Dateien blockieren den Deploy nicht
  git checkout -f --detach "$TAG"
  echo "[$(date -Is)] CHECKOUT_OK tag=$TAG"
} >>"$LOG_FILE" 2>&1
GIT_EC=$?
set -e
if [ "$GIT_EC" -ne 0 ]; then
  echo "ERROR: git fetch/checkout fehlgeschlagen (Exit $GIT_EC). Log: $LOG_FILE" >&2
  tail -40 "$LOG_FILE" >&2
  exit "$GIT_EC"
fi

export BEC_DEPLOY_PHASE=install
exec bash "$SELF" "$TAG"
