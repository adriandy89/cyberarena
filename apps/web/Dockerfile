# Multi-stage production image for the web app.
# Built from the monorepo root:  docker build -f apps/web/Dockerfile .
# Optimized/verified in phase 008 (deploy-hardening); base version from phase 000.

# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- prepare: prune the monorepo to web + its workspace deps ---
FROM base AS prepare
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile \
  && pnpm turbo prune @repo/web --docker

# --- builder: install pruned deps and build (standalone output) ---
FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=@repo/web...

# --- runner: minimal, non-root ---
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN groupadd -g 10001 app && useradd -u 10001 -g app -s /bin/sh -m app
WORKDIR /app
COPY --from=builder --chown=10001:10001 /app/apps/web/.next/standalone ./
USER 10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
