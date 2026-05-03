# Meezy Archive Registry

Meezy Archive Registry is a Shopify React Router app for authenticity verification, digital ownership, and resale trust workflows. It includes:

- embedded admin views for auth items, products, batches, transfers, scan logs, flags, and settings
- a public verification route at `/a/verify/:token`
- PostgreSQL + Prisma as the registry system of record
- webhook-driven ownership updates
- a customer account extension starter for authenticated item history
- Cloudflare Workers deployment scaffolding for a stable production URL

## Stack

- Shopify app: React Router + `@shopify/shopify-app-react-router`
- Database: PostgreSQL + Prisma
- QR layer: app proxy + token hashing + claim codes
- Customer surface: new customer accounts extension
- Deployment path: GitHub + Cloudflare Workers

## Local development

### Requirements

- Node.js `20.19+` or `22.12+`
- PostgreSQL
- Shopify app credentials
- Shopify dev store with new customer accounts enabled

### Setup

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

### Run

```bash
npm run dev
```

### Validation

```bash
npm run ci
```

## Environment

Main local env file:

- [`.env.example`](./.env.example)

Optional Cloudflare local Worker env file:

- [`.dev.vars.example`](./.dev.vars.example)

### Important variables

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL`
- `DATABASE_URL`
- `HYPERDRIVE_CONNECTION_STRING`

When `HYPERDRIVE_CONNECTION_STRING` is present, [`app/db.server.ts`](./app/db.server.ts) automatically switches Prisma to the `@prisma/adapter-pg` adapter so the Worker can use Hyperdrive-backed Postgres access.

## Cloudflare Workers

This repo now includes:

- [`wrangler.jsonc`](./wrangler.jsonc)
- [`worker/index.ts`](./worker/index.ts)
- Cloudflare npm scripts in [`package.json`](./package.json)
- GitHub CI in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)

The Worker entrypoint delegates incoming requests to the React Router server build so Cloudflare serves the app through a stable Worker URL instead of a temporary tunnel.

### Local Cloudflare commands

```bash
npm run cf:dev
npm run cf:deploy
```

## Important routes

- `/app`
- `/app/auth-items`
- `/app/batches`
- `/app/transfers`
- `/app/scan-logs`
- `/app/flags`
- `/a/verify/:token`

## Deployment guide

Full GitHub + Cloudflare handoff steps live in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Notes

- `.env` and `.dev.vars` stay out of git
- `package-lock.json` is now intended to be committed
- old temporary tunnel flow is no longer the target deployment path; stable domain should come from Cloudflare after the first real deploy
