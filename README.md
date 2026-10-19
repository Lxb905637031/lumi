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

The admin console uses account/password login and real API data; it no longer uses a build-time token or preview fixtures. Provision a local account with `LUMI_ADMIN_USERNAME` and a self-generated `LUMI_ADMIN_PASSWORD` (12–256 characters) when running `pnpm --filter @lumi/api db:seed`, then start `pnpm dev:admin`. Never commit a real password. Password changes through this local provisioning command revoke previous sessions. The seed command is an explicit operator action, not an automatic production bootstrap.

Prisma, seed and integration scripts load the workspace-root `.env` if present; existing environment variables take precedence. `db:push` is for local development only: versioned production migrations are still an open release gate. Real WeChat login, private object storage and a real AI provider have not been accepted.

The current implementation/verification status is recorded in [the 80-item delivery checklist](docs/architecture/DELIVERY-MATRIX.md). API checks do not substitute for WeChat developer-tool, iOS or Android acceptance. Run `pnpm --filter @lumi/api test:integration` against the local running API, PostgreSQL and Redis; the script uses unique fixtures and cleans up only its own data. It refuses non-loopback API URLs and requires the API to report free development mode.

## Engineering rules

- Business logic belongs in feature modules, not in `AppModule`.
- Controllers accept validated DTOs and return explicit API contracts.
- List endpoints are bounded and cursor-paginated.
- User media stays private until moderation and explicit publishing.
- Generation tasks are asynchronous and idempotent.
- Generation tasks use the self-hosted Redis/BullMQ queue with retry, cancellation, dead-letter state, manual retry, and an explicit local SVG provider for free development. The local provider is not a production AI model.
- Moderation routes use separate authentication and RBAC guards; status changes are conditionally updated and written to an audit table.
- Database migrations and API tests are required before a production release.
- Run `pnpm check` before opening a pull request. It runs formatting, lint, typecheck, unit tests, and app builds.
- Release readiness and required manual acceptance are tracked in `docs/architecture/DEFINITION-OF-DONE.md`.
