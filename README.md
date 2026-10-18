# Lumi

Lumi is an enterprise-oriented monorepo for an AI styling and image community mini program.

## Workspace layout

```text
apps/
  api/       NestJS API and Prisma schema
  admin/     React/Vite moderation console
  miniapp/   Taro/React WeChat mini program
packages/
  contracts/ Shared API contracts and domain enums
```

See [docs/architecture/ENGINEERING-ARCHITECTURE.md](docs/architecture/ENGINEERING-ARCHITECTURE.md) for module boundaries, feature directory structure, dependency rules, and code conventions.

## Start locally

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:generate
pnpm db:push
pnpm dev:api
```

API health check: `http://localhost:4300/api/v1/health`.

The zero-budget development mode is enabled by `FREE_MODE=true`. It disables payment and allows the AI generation provider to be a local or mock implementation. A real public deployment still needs a stable HTTPS endpoint, storage, backups, moderation and model capacity.

## Engineering rules

- Business logic belongs in feature modules, not in `AppModule`.
- Controllers accept validated DTOs and return explicit API contracts.
- List endpoints are bounded and cursor-paginated.
- User media stays private until moderation and explicit publishing.
- Generation tasks are asynchronous and idempotent.
- Database migrations and API tests are required before a production release.
- Run `pnpm check` before opening a pull request. It runs formatting, lint, typecheck, unit tests, and app builds.
- Release readiness and required manual acceptance are tracked in `docs/architecture/DEFINITION-OF-DONE.md`.
