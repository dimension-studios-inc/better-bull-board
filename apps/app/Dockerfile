FROM node:24.21.0-alpine AS base
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
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
ENV HOSTNAME="0.0.0.0"

# Pin matches package.json packageManager. Node runs the build tools; the runner stage is bun only.
COPY --from=oven/bun:1.4.2-alpine /usr/local/bin/bun /usr/local/bin/
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

#* ---- Prepare stage ----
FROM base AS prepare
COPY . .
# Same turbo as package.json: bunx without a version fetches the latest.
RUN TURBO_VERSION=$(bun -p 'require("./package.json").devDependencies.turbo') \
  && bunx turbo@$TURBO_VERSION prune @better-bull-board/app --docker

#* ---- Installer stage ----
# Install full dependencies (including devDependencies) because `next build` needs
# type definitions, PostCSS plugins, and other build-time tooling. The final image
# only copies Next's standalone output, so devDependencies never leak into runtime.
# `--ignore-scripts` skips the root `lefthook install` prepare hook (git/lefthook
# are not available in this image, and lefthook is a devDependency).
FROM base AS installer
COPY --from=prepare /app/out/json/ .
# No store cache mount: it restored nothing on ephemeral builders, and a mount is
# a separate filesystem, so bun copies instead of hardlinking out of its cache.
RUN bun ci --ignore-scripts
COPY --from=prepare /app/out/full/ .

#* ---- Builder stage ----
# Continues from the installer instead of copying its /app into a new stage (12 s for the app's node_modules)
FROM installer AS builder
ENV NODE_OPTIONS="--max-old-space-size=6144"

# Dummy env for the build to work without .env
ARG ENV=production
ENV ENV=$ENV
ARG CLICKHOUSE_URL=http://localhost:8123
ENV CLICKHOUSE_URL=$CLICKHOUSE_URL
ARG CLICKHOUSE_USER=default
ENV CLICKHOUSE_USER=$CLICKHOUSE_USER
ARG CLICKHOUSE_PASSWORD=default
ENV CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD
ARG CLICKHOUSE_DB=default
ENV CLICKHOUSE_DB=$CLICKHOUSE_DB
ARG REDIS_HOST=localhost
ENV REDIS_HOST=$REDIS_HOST
ARG ADMIN_EMAIL=admin@example.com
ENV ADMIN_EMAIL=$ADMIN_EMAIL
ARG ADMIN_PASSWORD=admin
ENV ADMIN_PASSWORD=$ADMIN_PASSWORD
ARG JWT_SECRET=secret
ENV JWT_SECRET=$JWT_SECRET
ARG WEBSOCKET_URL=ws://localhost:8081
ENV WEBSOCKET_URL=$WEBSOCKET_URL
ARG WEBSOCKET_PORT=8081
ENV WEBSOCKET_PORT=$WEBSOCKET_PORT
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
ENV DATABASE_URL=$DATABASE_URL

RUN bun run build:app
# bun installs both libc builds of sharp and Next's trace keeps both; the runner is Alpine (musl).
RUN find apps/app/.next/standalone/node_modules/.bun -maxdepth 1 \
  \( -name '@img+sharp-linux-*' -o -name '@img+sharp-libvips-linux-*' -o -name '*-gnu@*' \) \
  -exec rm -rf {} +

#* ---- Runner stage ----
# Bun serves the standalone server.js; `next dev` and `next build` stay on Node.
FROM oven/bun:1.4.2-alpine AS runner
RUN apk add --no-cache libc6-compat \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME="0.0.0.0"
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/public ./apps/app/public

# Exec form: bun is PID 1 and receives SIGTERM directly.
CMD ["bun", "apps/app/server.js"]
