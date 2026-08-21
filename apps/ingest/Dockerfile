#* ---- Base stage ----
FROM node:24.19.0-alpine AS base
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

# Pin matches package.json packageManager (base has no package.json yet).
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

#* ---- Prepare stage ----
FROM base AS prepare
COPY . .
RUN --mount=type=cache,target=/root/.cache/turbo \
  pnpm dlx turbo@2.10.11 prune @better-bull-board/ingest --docker

#* ---- Installer stage (dev deps for build) ----
# `--ignore-scripts` skips the root `lefthook install` prepare hook (git/lefthook
# are not available in this image, and lefthook is a devDependency).
FROM base AS installer
ENV NODE_ENV=development

COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm ci --ignore-scripts
COPY --from=prepare /app/out/full/ .

#* ---- Builder stage ----
FROM base AS builder
ENV NODE_OPTIONS="--max-old-space-size=6144"
COPY --from=installer /app /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  --mount=type=cache,target=/root/.cache/turbo \
  pnpm run build:ingest

#* ---- Runtime stage ----
# Keep the full built tree: ingest runs `drizzle-kit migrate` from packages/db
# at startup, so the image needs that package's config, SQL, and bin — not
# only dist output.
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --home /home/nodeapp nodeapp

ENV HOME=/home/nodeapp

COPY --from=builder /app /app

RUN chown -R nodeapp:nodejs /app /home/nodeapp
USER nodeapp

CMD ["node", "apps/ingest/dist/index.mjs"]
