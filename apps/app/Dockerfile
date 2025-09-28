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
ENV NODE_OPTIONS="--max-old-space-size=6144"

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
COPY --from=installer /app .
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