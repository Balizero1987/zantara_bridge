# AGENTS.md — Zantara Bridge

## Setup
- Install deps: pnpm install
- Build: pnpm build
- Dev server: pnpm dev

## Quality Gates
- Lint: pnpm lint
- Typecheck: pnpm typecheck
- Unit tests: pnpm test
- E2E tests: pnpm e2e

## Security
- Static analysis: pnpm semgrep --config p/ci
- Dependency audit: pnpm audit --prod

## Release
- Preview: pnpm preview
- Deploy (Cloud Run): pnpm deploy:run

> NOTE FOR AGENTS:
> 1) Esegui SEMPRE i Quality Gates prima di proporre PR.
> 2) Se falliscono, correggi e rilancia i test finché non sono verdi.
