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
pnpm db:deploy
pnpm --filter @lumi/api storage:init-local
pnpm dev:api
```

API health check: `http://localhost:4300/api/v1/health`.

The zero-budget development mode is enabled by `FREE_MODE=true`. It disables payment and allows the AI generation provider to be a local or mock implementation. A real public deployment still needs a stable HTTPS endpoint, storage, backups, moderation and model capacity.

The admin console uses account/password login and real API data; it no longer uses a build-time token or preview fixtures. Provision a local account with `LUMI_ADMIN_USERNAME` and a self-generated `LUMI_ADMIN_PASSWORD` (12–256 characters) when running `pnpm --filter @lumi/api db:seed`, then start `pnpm dev:admin`. Never commit a real password. Password changes through this local provisioning command revoke previous sessions. The seed command is an explicit operator action, not an automatic production bootstrap.

Prisma, seed and integration scripts load the workspace-root `.env` if present; existing environment variables take precedence. Use versioned `db:deploy` for initialization and deployment; `db:push` is for disposable development schemas only. An existing pre-migration database must follow the guarded [baseline adoption procedure](docs/operations/DATABASE-MIGRATIONS.md), without resetting data. Real WeChat login and a real AI provider have not been accepted.

Private media uses an S3 adapter with signed POST uploads, server-side image decoding/sanitization, short-lived authorized reads and durable object cleanup. Local compose runs a digest-pinned Apache-2.0 SeaweedFS (S3-compatible) instance; only its S3 port is exposed on loopback. The checked-in account is development-only, not a production credential. The previous MinIO volume is retained and never deleted. See [private-media architecture](docs/architecture/PRIVATE-MEDIA.md) and [storage operations](docs/operations/PRIVATE-STORAGE.md). Run `LUMI_API_URL=http://127.0.0.1:4300/api/v1 pnpm --filter @lumi/api test:storage` against an API using `MEDIA_STORAGE_DRIVER=s3`; this is real local S3 integration, not production/WeChat acceptance. Explicit `MEDIA_STORAGE_DRIVER=local` retains the development base64 adapter, which production configuration rejects.

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
