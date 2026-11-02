# syntax=docker/dockerfile:1
# Multi-stage production image for the API.
# Built from the monorepo root:  docker build -f apps/api/Dockerfile .

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

# --- runner: non-root, secrets via entrypoint, optional migrations on boot ---
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable && groupadd -g 10001 app && useradd -u 10001 -g app -s /bin/sh -m app
WORKDIR /app
COPY --from=builder --chown=10001:10001 /app /app
# The seed reads packages/content/dist; the answer sources are not needed at
# runtime and should not sit in clear text in the image.
RUN rm -rf /app/packages/content/private
COPY --chown=10001:10001 apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
USER 10001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
