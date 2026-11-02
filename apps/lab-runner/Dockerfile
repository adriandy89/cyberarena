# syntax=docker/dockerfile:1
# lab-runner image (phase 011, ADR-015). Built from the monorepo root:
#   docker build -f apps/lab-runner/Dockerfile .
# The labs are baked in (immutable); flags come from a read-only mount.

FROM docker:29.9.2-cli AS docker-cli

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- prepare: prune the monorepo to the runner ---
FROM base AS prepare
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile \
  && pnpm turbo prune @repo/lab-runner --docker

# --- builder: lint the labs, write the manifest, compile ---
FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
# labs/ lives outside the workspace packages, so prune does not carry it.
COPY labs ./labs
RUN pnpm turbo build --filter=@repo/lab-runner

# --- runner: node + the docker CLI and compose plugin, nothing else ---
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    DOCKER_CONFIG=/tmp/.docker \
    LABS_DIR=/app/labs \
    LAB_MANIFEST=/app/dist/manifest.json
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
WORKDIR /app
COPY --from=builder /app/apps/lab-runner/dist ./dist
COPY --from=builder /app/labs ./labs
# Root on purpose: the process talks to docker.sock, which is root-equivalent
# anyway (ADR-015). The compose service drops every capability.
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 CMD ["node", "dist/cli.js", "health"]
CMD ["node", "dist/main.js"]
