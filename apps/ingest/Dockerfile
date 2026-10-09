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

# Pin matches package.json packageManager. Bun only installs; Node runs everything.
COPY --from=oven/bun:1.4.2-alpine /usr/local/bin/bun /usr/local/bin/
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

#* ---- Prepare stage ----
FROM base AS prepare
COPY . .
# Same turbo as package.json: bunx without a version fetches the latest.
RUN --mount=type=cache,target=/root/.cache/turbo \
  TURBO_VERSION=$(bun -p 'require("./package.json").devDependencies.turbo') \
  && bunx turbo@$TURBO_VERSION prune @better-bull-board/ingest --docker

#* ---- Installer stage (dev deps for build) ----
# `--ignore-scripts` skips the root `lefthook install` prepare hook (git/lefthook
# are not available in this image, and lefthook is a devDependency).
FROM base AS installer
COPY --from=prepare /app/out/json/ .
# No store cache mount: it restored nothing on ephemeral builders, and a mount is
# a separate filesystem, so bun copies instead of hardlinking out of its cache.
RUN bun ci --ignore-scripts
COPY --from=prepare /app/out/full/ .

#* ---- Builder stage ----
FROM base AS builder
ENV NODE_OPTIONS="--max-old-space-size=6144"
COPY --from=installer /app /app
RUN --mount=type=cache,target=/root/.cache/turbo \
  bun run build:ingest

#* ---- Runtime files stage ----
FROM builder AS runtime-files

RUN set -eux; \
  mkdir -p /app/runtime/apps/ingest; \
  cp -r /app/apps/ingest/dist /app/runtime/apps/ingest/dist; \
  \
  find /app/packages \
  -type d -name dist \
  -not -path "*/node_modules/*" \
  -print0 \
  | while IFS= read -r -d '' d; do \
  pkg_dir="$(dirname "$d")"; \
  rel="${pkg_dir#/app/}"; \
  mkdir -p "/app/runtime/$rel"; \
  cp -r "$d" "/app/runtime/$rel/"; \
  done; \
  \
  # ingest runs `drizzle-kit migrate` from packages/db at startup
  mkdir -p /app/runtime/packages/db; \
  cp /app/packages/db/drizzle.config.ts /app/runtime/packages/db/drizzle.config.ts; \
  cp -r /app/packages/db/drizzle /app/runtime/packages/db/drizzle; \
  cp -r /app/packages/db/src /app/runtime/packages/db/src

#* ---- Runtime stage ----
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --home /home/nodeapp nodeapp

ENV HOME=/home/nodeapp

COPY --from=prepare /app/out/json/ .
# Drop bun's cache in the same layer so it never ships; node_modules hardlinks
# already hold the file data.
RUN bun ci --ignore-scripts --production \
  && bun pm cache rm
COPY --from=runtime-files --chown=nodeapp:nodejs /app/runtime/ /app/

USER nodeapp

CMD ["node", "apps/ingest/dist/index.mjs"]
