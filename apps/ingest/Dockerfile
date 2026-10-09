#* ---- Base stage ----
FROM node:24.21.0-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

ARG TURBO_TEAM
ARG TURBO_TOKEN
ARG TURBO_API

ENV TURBO_TEAM=$TURBO_TEAM
ENV TURBO_TOKEN=$TURBO_TOKEN
ENV TURBO_API=$TURBO_API
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_HOSTNAME=0.0.0.0
ENV PORT=8080

#* ---- Tools stage ----
# Pin matches package.json packageManager. Bun only installs and builds; Node runs
# everything, so the runner starts from base and never ships the 70 MB bun binary.
FROM base AS tools
COPY --from=oven/bun:1.4.2-alpine /usr/local/bin/bun /usr/local/bin/
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

#* ---- Prepare stage ----
FROM tools AS prepare
COPY . .
# Same turbo as package.json: bunx without a version fetches the latest.
RUN --mount=type=cache,target=/root/.cache/turbo \
  TURBO_VERSION=$(bun -p 'require("./package.json").devDependencies.turbo') \
  && bunx turbo@$TURBO_VERSION prune @better-bull-board/ingest --docker

#* ---- Installer stage (dev deps for build) ----
# `--ignore-scripts` skips the root `lefthook install` prepare hook (git/lefthook
# are not available in this image, and lefthook is a devDependency).
FROM tools AS installer
COPY --from=prepare /app/out/json/ .
# No store cache mount: it restored nothing on ephemeral builders, and a mount is
# a separate filesystem, so bun copies instead of hardlinking out of its cache.
RUN bun ci --ignore-scripts
COPY --from=prepare /app/out/full/ .

#* ---- Builder stage ----
FROM tools AS builder
ENV NODE_OPTIONS="--max-old-space-size=6144"
COPY --from=installer /app /app
RUN --mount=type=cache,target=/root/.cache/turbo \
  bun run build:ingest

#* ---- Runtime files stage ----
# Only the files the entries import (Next's standalone approach), like the main repo's service
# images: `bun install --production` would still ship every workspace package's devDependencies.
# ingest runs `drizzle-kit migrate` from packages/db at startup, so the CLI and its config are
# traced too, and the migrations are copied explicitly.
FROM builder AS runtime-files
COPY scripts/trace-runtime.ts scripts/
RUN node --no-warnings scripts/trace-runtime.ts \
  apps/ingest/dist/index.mjs \
  packages/db/node_modules/drizzle-kit/bin.cjs \
  packages/db/drizzle.config.ts \
  /app/runtime \
  && cp -r packages/db/drizzle /app/runtime/packages/db/

#* ---- Runtime stage ----
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --home /home/nodeapp nodeapp

ENV HOME=/home/nodeapp

COPY --from=runtime-files --chown=nodeapp:nodejs /app/runtime/ /app/

USER nodeapp

CMD ["node", "apps/ingest/dist/index.mjs"]
