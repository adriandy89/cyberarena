# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems in the platform.

Report them privately through GitHub: **Security → Report a vulnerability** on this repository.
Include the affected component, steps to reproduce and the impact you observed. You should get a first
answer within a week. Once a fix ships, the advisory is published with credit, unless you prefer to stay
anonymous.

Only the latest `main` branch receives security fixes.

## Scope

**In scope:** the platform code and its deployment files:

- `apps/web`, `apps/api` and `apps/lab-runner`;
- `packages/*`;
- the Docker stacks and scripts in `infra/`.

Examples: authentication or authorization bypass, leaking answers or flags through the API, escaping a lab
through the lab-runner, and container or network isolation flaws.

**Out of scope:**

- **Intentional vulnerabilities.** Everything under `labs/` (SQL injection, XSS, SSRF, weak credentials…)
  and the techniques taught in the rooms are vulnerable on purpose.
- **Answers and flags in the repository.** The content is stored as code
  (`packages/content/private/answers`, `labs/*/flags.env.example`). That is a known design choice for a
  self-hosted learning platform, not a leak.
- **Missing hardening that the docs already list as an operator decision**, for example exposing labs on
  a LAN or running without HTTPS on a private network.

## Running it safely

- **Labs are deliberately vulnerable applications.** By default their ports are published on `127.0.0.1`
  only. Never expose them to the internet. On a LAN (`LAB_BIND_ADDRESS`), only do it on a network you
  trust.
- **The lab-runner mounts the Docker socket**, which is root-equivalent on the host. It has no published
  ports, lives on an internal network shared only with the API, authenticates every call with a token and
  only starts labs from a manifest built into its image (see `docs/adr/ADR-015-lab-runner-docker-socket.md`).
  Run CyberArena on a dedicated host or VM.
- **Generate your own secrets** for production, as described in `infra/stacks/prod/secrets/README.md`.
  The `dev-only-*` values in the templates are meant for local development only.
