FROM node:22-alpine AS base
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

FROM base AS turbo
RUN npm install turbo --global

#* ---- Prepare stage ----
FROM turbo AS prepare
COPY . .
RUN turbo prune @better-bull-board/app --docker

#* ---- Installer stage ----
FROM base AS installer
COPY --from=prepare /app/out/json/ .
RUN npm ci --omit=dev
COPY --from=prepare /app/out/full/ .

#* ---- Builder stage ----
FROM turbo AS builder
ENV NODE_OPTIONS="--max-old-space-size=6144"
COPY --from=installer /app .

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


RUN npm run build:app

#* ---- Runner stage ----
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/public ./apps/app/public

CMD ["node", "apps/app/server.js"]