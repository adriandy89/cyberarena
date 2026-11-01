# Multi-stage production image for the API.
# Built from the monorepo root:  docker build -f apps/api/Dockerfile .
# Optimized/verified in phase 008 (deploy-hardening); base version from phase 000.

# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- prepare: prune the monorepo to the API + its workspace deps ---
FROM base AS prepare
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile \
  && pnpm turbo prune @repo/api --docker

# --- builder: install pruned deps and build ---
FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN pnpm turbo build --filter=@repo/api...

# --- runner: minimal, non-root ---
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
RUN groupadd -g 10001 app && useradd -u 10001 -g app -s /bin/sh -m app
WORKDIR /app
COPY --from=builder --chown=10001:10001 /app /app
USER 10001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
