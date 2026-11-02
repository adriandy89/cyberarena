# Contributing to CyberArena

Thanks for helping! New rooms, translations, bug fixes and new labs are all welcome.

## Before you start

- **Small fixes** (typos, an obvious bug): just open a pull request.
- **Anything bigger** (a feature, a new path, a new lab): open an issue first so we can agree on the scope.
- **Security problems:** do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Set up

Follow [Getting started](README.md#getting-started) in the README. Option B (apps running on your machine)
gives the fastest feedback loop.

## How the project is organized

CyberArena is built with **Spec-Driven Development**:

- `specs/` is the source of truth. It holds the constitution, the roadmap and one folder per phase with its
  spec, plan and task list.
- Changes that alter behaviour should update the spec of their phase.
- Architectural decisions are recorded in `docs/adr/`.

AI coding agents (and humans who like checklists) should read [AGENTS.md](AGENTS.md) first.

**Languages:**

- **English** for code, comments and identifiers.
- **Spanish** for specs, ADRs and the runbook.
- **Content** is written in Spanish, with the English translation in `packages/content/translations/en/`.
  The build fails if a translation is missing.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Keep each commit focused. Use [Conventional Commits](https://www.conventionalcommits.org/), for
   example `feat(web): …`, `fix(api): …`, or `docs: …`; content changes use `feat(content): …`.
3. Add or update tests: Vitest for units, Playwright (`apps/web/e2e`) for user flows.
4. Run the full check, the same one CI runs:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```

5. Open a pull request that explains **what** changed and **why**, and link the issue.

Never commit `.env` files, secrets or real lab flags (`labs/<slug>/flags.env`); `.gitignore` already covers
them.

## Adding content

Rooms are MDX files plus a private YAML file with the answers, all validated at build time. Read
[docs/content-guide.md](docs/content-guide.md). In short:

- `packages/content/content/rooms/<slug>/` holds the room (`index.mdx`) and its tasks (`tasks/*.mdx`).
- `packages/content/private/answers/<slug>.yaml` holds the accepted answers. They are hashed into the
  database and never sent to the browser.
- `packages/content/translations/en/<slug>.json` holds the English version.
- All content must be original. Do not copy material from other training platforms.

## Adding a lab

A lab is a self-contained Docker Compose project in `labs/<slug>/`. The build lints every lab and rejects
unsafe ones. Each lab must:

- publish its ports on `127.0.0.1` only;
- drop all capabilities and set `no-new-privileges`;
- set CPU, memory and PID limits and `restart: "no"`;
- use pinned images;
- never mount host paths outside its folder or the Docker socket;
- list its flags in `flags.env.example`.

Start from `labs/_template/`; the details are in the "Labs" section of the content guide.

## Code of conduct

Be respectful and constructive. Harassment or discrimination of any kind is not tolerated. The material
here is for learning: only test systems you own or are explicitly authorized to test.
