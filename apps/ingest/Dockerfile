#* ---- Base stage ----
FROM node:22-alpine AS base
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
ENV NODE_OPTIONS="--max-old-space-size=6144"


#* ---- Turbo stage ----
FROM base AS turbo
RUN npm install turbo --global


#* ---- Prepare stage ----
FROM turbo AS prepare
COPY . .
RUN turbo prune @better-bull-board/ingest --docker


#* ---- Installer stage ----
FROM base AS installer
COPY --from=prepare /app/out/json/ .
RUN npm ci --omit=dev
COPY --from=prepare /app/out/full/ .


#* ---- Builder stage ----
FROM turbo AS builder
COPY --from=installer /app .
RUN npm run build:ingest



#* ---- Runtime stage ----
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --home /home/nodeapp nodeapp

ENV HOME=/home/nodeapp

# Copy app
COPY --from=builder /app /app

RUN chown -R nodeapp:nodejs /app /home/nodeapp
USER nodeapp

CMD ["node", "apps/ingest/dist/index.js"]