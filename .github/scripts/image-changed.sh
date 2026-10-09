#!/usr/bin/env bash
# Tells Deploy whether an image needs a new build since the commit its running image was built from.
# Usage: image-changed.sh <workspace package> [extra root paths the image is built from...]
# Env: EVENT (github.event_name), DEPLOYED (the tag of the running image: a commit SHA, or anything
# else for an image no deploy pinned). Writes changed=true|false to $GITHUB_OUTPUT.
set -euo pipefail

package="$1"
shift
output="${GITHUB_OUTPUT:-/dev/stdout}"

result() {
  echo "changed=$1" >>"$output"
  echo "$2"
  exit 0
}

# Compared with what runs rather than with the previous main commit, so an image whose last build or
# rollout failed is built again. Manual runs, and running images that are not tagged with a commit of
# this history (:latest after a manual apply, rewritten history), build.
if [ "${EVENT:-}" != "push" ]; then
  result true "Manual run: building $package."
fi
if ! [[ "${DEPLOYED:-}" =~ ^[0-9a-f]{40}$ ]] || ! git cat-file -e "${DEPLOYED}^{commit}" 2>/dev/null; then
  result true "The running image (${DEPLOYED:-none}) is not tagged with a known commit: building $package."
fi

# Root files the images are built from, which turbo does not map to a package (the root
# package.json and bunfig.toml change the install, the ingest image runs scripts/trace-runtime.ts).
root_inputs=(package.json bun.lock bunfig.toml turbo.json .dockerignore "$@")
if ! git diff --quiet "$DEPLOYED" HEAD -- "${root_inputs[@]}"; then
  result true "Root build inputs changed since ${DEPLOYED:0:7}: building $package."
fi

# The package itself (its Dockerfile included) or any workspace package it depends on
turbo_version="$(bun -p 'require("./package.json").devDependencies.turbo')"
affected="$(TURBO_SCM_BASE="$DEPLOYED" bunx "turbo@$turbo_version" ls --affected --output=json)"
if echo "$affected" | PACKAGE="$package" bun -e '
  const { packages } = JSON.parse(await Bun.stdin.text())
  process.exit(packages.items.some((item) => item.name === process.env.PACKAGE) ? 0 : 1)
'; then
  result true "$package or one of its dependencies changed since ${DEPLOYED:0:7}: building it."
fi

result false "$package is unchanged since ${DEPLOYED:0:7}: keeping the running image."
