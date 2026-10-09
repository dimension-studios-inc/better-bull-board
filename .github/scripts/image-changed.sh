#!/usr/bin/env bash
# Tells Deploy whether an image needs a new build since the last deployed commit.
# Usage: image-changed.sh <workspace package> [extra root paths the image is built from...]
# Env: EVENT (github.event_name), BEFORE (github.event.before). Writes changed=true|false to $GITHUB_OUTPUT.
set -euo pipefail

package="$1"
shift
output="${GITHUB_OUTPUT:-/dev/stdout}"

result() {
  echo "changed=$1" >>"$output"
  echo "$2"
  exit 0
}

# Manual runs, and pushes whose previous commit is not in this history (first push, rewritten
# history), build everything.
if [ "${EVENT:-}" != "push" ] || ! git cat-file -e "${BEFORE:-}^{commit}" 2>/dev/null; then
  result true "No previous deploy to compare with: building $package."
fi

# Root files the images are built from, which turbo does not map to a package (the root
# package.json and bunfig.toml change the install, the ingest image runs scripts/trace-runtime.ts).
root_inputs=(package.json bun.lock bunfig.toml turbo.json .dockerignore "$@")
if ! git diff --quiet "$BEFORE" HEAD -- "${root_inputs[@]}"; then
  result true "Root build inputs changed since ${BEFORE:0:7}: building $package."
fi

# The package itself (its Dockerfile included) or any workspace package it depends on
turbo_version="$(bun -p 'require("./package.json").devDependencies.turbo')"
affected="$(TURBO_SCM_BASE="$BEFORE" bunx "turbo@$turbo_version" ls --affected --output=json)"
if echo "$affected" | PACKAGE="$package" bun -e '
  const { packages } = JSON.parse(await Bun.stdin.text())
  process.exit(packages.items.some((item) => item.name === process.env.PACKAGE) ? 0 : 1)
'; then
  result true "$package or one of its dependencies changed since ${BEFORE:0:7}: building it."
fi

result false "$package is unchanged since ${BEFORE:0:7}: keeping the running image."
