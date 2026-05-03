# GitHub and Cloudflare Workers

This repository is prepared for two steps:

1. Push the app to GitHub
2. Connect the repository to Cloudflare Workers so the Shopify app has a permanent public URL

## 1. GitHub push

Run these commands from the project root:

```bash
git init -b main
git add .
git commit -m "Prepare Meezy Archive Registry for GitHub and Cloudflare"
git remote add origin git@github.com:<your-user>/<your-repo>.git
git push -u origin main
```

## 2. Cloudflare Workers deployment

The app now includes:

- an explicit [`wrangler.jsonc`](./wrangler.jsonc)
- a Worker entrypoint at [`worker/index.ts`](./worker/index.ts)

The Worker entrypoint delegates requests to the generated React Router server build, while Cloudflare serves static assets from `build/client`.

### Local CLI deploy

```bash
npm install
npm run build
npm run cf:deploy
```

### GitHub -> Cloudflare Workers Builds

In Cloudflare Dashboard:

1. Go to `Workers & Pages`
2. Create a new Worker from Git
3. Select this repository
4. Keep the project root as `/`
5. Use `npm run build` as the build command if Cloudflare asks for one
6. Let Wrangler read [`wrangler.jsonc`](./wrangler.jsonc)
7. If Cloudflare asks for an entry file, keep [`worker/index.ts`](./worker/index.ts)

## Required Cloudflare variables and secrets

Set these in Cloudflare before the first production deploy:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL`
- `SHOP_CUSTOM_DOMAIN` if you use a custom `.myshopify.com` mapping rule

### Database options

Use one of these runtime database inputs:

- `DATABASE_URL`
  Best when you deploy outside Workers or want the same direct Postgres URL as local development.
- `HYPERDRIVE_CONNECTION_STRING`
  Recommended for Workers. When this variable is present, [`app/db.server.ts`](./app/db.server.ts) switches Prisma to the `@prisma/adapter-pg` driver adapter for Hyperdrive-backed Postgres access.

## Shopify values to update after Cloudflare gives you a stable domain

Assume Cloudflare gives you `https://registry.meezyarchive.com`:

- `App URL`
  `https://registry.meezyarchive.com`
- Redirect URL
  `https://registry.meezyarchive.com/auth/callback`
- App proxy backend URL
  `https://registry.meezyarchive.com`
- App proxy prefix
  `a`
- App proxy subpath
  `verify`

## Useful commands

```bash
npm run ci
npm run cf:dev
npm run cf:deploy
npm run cf:typegen
```

## Official references

- Cloudflare React Router on Workers:
  [developers.cloudflare.com/workers/framework-guides/web-apps/react-router](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- Cloudflare Node.js compatibility:
  [developers.cloudflare.com/workers/runtime-apis/nodejs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- Cloudflare Prisma + Hyperdrive:
  [developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/)
- Shopify app proxy:
  [shopify.dev/docs/apps/build/online-store/app-proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies)
