# Subrent Manager

Leases, tenants, rent, expenses and inventory for a subrenting business.
Web app, mobile-first, offline-first. See the product spec for the full design.

## Layout

| Path | What |
| --- | --- |
| `apps/api` | Hono API, Drizzle + PostgreSQL, auth, sync endpoints, signed file URLs |
| `apps/web` | React + TanStack Router PWA with an on-device database (Dexie) |
| `packages/shared` | Money helpers and the shared entity/sync types |
| `packages/sync-client` | The on-device database, outbox and sync engine (no UI) |

## Run it locally

```sh
npm install
npm run user:create -w @subrent/api -- "Your Name" you@example.com 'a long password'   # once per partner
npm run dev:api     # http://localhost:8787, embedded database in apps/api/data
npm run dev:web     # http://localhost:5173, proxies /api to the API
```

With no `DATABASE_URL`, development uses an embedded PostgreSQL stored in `apps/api/data/pglite`.

## Configuration (production)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Migrations run on start. |
| `JWT_SECRET` | yes | At least 32 characters. |
| `WEB_DIST` | no | Folder with the built web app; the Docker image sets it. |
| `CORS_ORIGIN` | no | Only if the web app is served from another origin. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | for uploads | Without them, `/api/files/sign` returns 503. |

Create accounts on the server with the same `user:create` command, with `DATABASE_URL` set.

## Tests

```sh
npm test                                   # embedded database
TEST_DATABASE_URL=postgres://user:pass@host:5432/postgres npm test   # real PostgreSQL
```

With `TEST_DATABASE_URL` set, every test server gets its own throwaway database on that server.

## How sync works

- Every change is written to the device first and queued in an outbox. The app never waits on the network.
- The device pushes its outbox in order, then pulls everything after its cursor.
- Edits merge field by field; for the same field the later push wins.
- Payments and expenses are append-only: a correction is a new reversing row.
- Pushes are serialized by a database lock so a pulling device can never skip a row.

## Adding a table later

1. Add it to `ENTITY_NAMES` in `packages/shared/src/entities.ts` and to `tables` in `apps/api/src/schema.ts`.
2. `npm run db:generate -w @subrent/api` to create the migration.
3. Add the indexes it needs in a new Dexie `version(n)` in `packages/sync-client/src/db.ts`.
