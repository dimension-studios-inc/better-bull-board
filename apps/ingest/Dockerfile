# Use the official Node.js image as base
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/ingest/package*.json ./apps/ingest/
COPY packages/*/package*.json ./packages/*/
COPY _template/package*.json ./_template/

# Install dependencies
RUN npm ci

# Build the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build all dependencies and the ingest service
RUN npm run setup
RUN npm run build --filter=@better-bull-board/ingest

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy the built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/apps/ingest/dist ./apps/ingest/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/*/dist ./packages/*/
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

# Start the ingest service
CMD ["node", "apps/ingest/dist/index.js"]