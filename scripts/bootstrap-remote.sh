#!/usr/bin/env bash
set -euo pipefail

# Ensure we are inside the git repository root.
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$repo_root" ]]; then
  echo "[error] Not inside a git repository." >&2
  exit 1
fi
cd "$repo_root"

# Accept multiple environment variable spellings for compatibility.
remote_url="${GIT_REMOTE_URL:-}"
if [[ -z "$remote_url" ]]; then
  remote_url="${GitRemoteURL:-}"
fi
if [[ -z "$remote_url" ]]; then
  remote_url="${GITREMOTEURL:-}"
fi

if [[ -z "$remote_url" ]]; then
  cat >&2 <<'MSG'
[error] No remote URL provided.
Set one of the following environment variables before running this script:
  * GIT_REMOTE_URL
  * GitRemoteURL
  * GITREMOTEURL
Example (Linux/macOS):
  export GIT_REMOTE_URL="https://github.com/<owner>/<repo>.git"
For GitHub Actions, expose the secret explicitly:
  env:
    GIT_REMOTE_URL: ${{ secrets.GIT_REMOTE_URL }}
MSG
  exit 1
fi

current_url=$(git remote get-url origin 2>/dev/null || true)
if [[ -n "$current_url" ]]; then
  if [[ "$current_url" == "$remote_url" ]]; then
    action="kept"
  else
    git remote set-url origin "$remote_url"
    action="updated"
  fi
else
  git remote add origin "$remote_url"
  action="added"
fi

echo "[info] origin remote ${action} -> $remote_url"

if [[ "${1:-}" != "--skip-fetch" ]]; then
  git fetch origin --prune
fi
