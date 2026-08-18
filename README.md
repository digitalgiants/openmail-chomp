# VaultFoundry v8

A visual email builder / campaign platform built on Next.js, Postgres (Drizzle), and Better-Auth. You build emails from a drag-and-drop component tree, compile them to email-safe HTML via MJML, and organize reusable blocks and templates with full version history.

## Status: what's real vs. stubbed

Be aware of this before you go looking for something that isn't there yet:

| Area | Status |
|---|---|
| Email/template/block builder | Working |
| Postgres (emails, templates, blocks, links, assets) | Working — Drizzle, org-scoped |
| Auth (magic link + Google OAuth, orgs) | Working — Better-Auth |
| Asset uploads | Working — R2 when `STORAGE_PROVIDER=r2` and the `R2_*` vars are set, local disk otherwise. See [Cloudflare R2](#cloudflare-r2-asset-storage) below. |
| Campaign sending | **Not implemented.** `getDeliveryProvider()` throws by design. Magic-link sign-in emails already work through Resend (see below) — that's a separate, smaller code path from bulk campaign delivery. |
| Contacts / Campaigns pages | Placeholder screens |

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Postgres) — or point `DATABASE_URL` at a Postgres instance you already have

## Quick start

```bash
npm install
cp .env.example .env        # then fill in values — see below
npm run db:up                # starts local Postgres via Docker
npm run db:push              # applies the schema
npm run dev
```

Visit `http://localhost:3000/sign-in`. With no `RESEND_API_KEY` set, magic links are printed to your terminal instead of emailed — copy the URL from the server log into your browser to sign in. The first sign-in auto-creates a workspace (organization) and makes you its owner.

## Environment variables

Copy `.env.example` to `.env` and fill these in. Everything below is scoped per variable to the service that needs it.

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vaultfoundry

STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=vaultfoundry-assets
R2_PUBLIC_BASE_URL=

DELIVERY_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Only three of these are required to run the app today: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. The rest unlock optional features as you set them up.

---

### PostgreSQL

Default path is the bundled `docker-compose.yml`:

```bash
npm run db:up      # docker compose up -d — starts Postgres 16 on localhost:5432
npm run db:push     # applies src/db/schema.ts + src/db/auth-schema.ts directly (good for dev)
npm run db:down     # stop the container
```

`DATABASE_URL` in `.env.example` already matches the compose file's credentials (`postgres` / `postgres` / db `vaultfoundry`), so you shouldn't need to change it for local dev.

For a hosted Postgres instead (Neon, Supabase, RDS, etc.), just point `DATABASE_URL` at it — nothing else changes.

Two workflows exist:
- `npm run db:push` — pushes the schema straight to the database, no migration files. Fastest for local dev, fine while iterating.
- `npm run db:generate` then `npm run db:migrate` — generates versioned SQL migration files in `drizzle/` and applies them. Use this once you have a shared/production database, so schema changes are reviewable and repeatable.

### Better-Auth

`BETTER_AUTH_SECRET` signs sessions and cookies — generate one and never commit it:

```bash
openssl rand -base64 32
```

`BETTER_AUTH_URL` is the app's own base URL — `http://localhost:3000` in dev, your real domain in production. Both social OAuth redirects and magic-link URLs are built from this value, so it must be correct before either will work.

If you ever change the auth config (`src/lib/auth/auth.ts`) — add a plugin, change a field — regenerate the Drizzle schema for Better-Auth's own tables:

```bash
npm run auth:generate
```

This overwrites `src/db/auth-schema.ts`. It's checked into git and is the single source of truth for the `user`, `session`, `account`, `verification`, `organization`, `member`, and `invitation` tables — don't hand-edit it.

### Google OAuth

Used for "Continue with Google" on the sign-in page.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or pick an existing one).
2. **APIs & Services → OAuth consent screen** — configure it (External is fine for testing; add yourself as a test user if the app is still in "Testing" publishing status).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`
     - Local dev: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://yourdomain.com/api/auth/callback/google`
4. Copy the generated **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.

Without these set, the Google button on `/sign-in` will fail — magic link sign-in still works independently.

### Resend (magic-link email)

Used to actually deliver the sign-in email instead of just logging the link to your console.

1. Create an account at [resend.com](https://resend.com) and grab an API key from the dashboard.
2. Add and verify a sending domain under **Domains** (or use their shared testing domain for early development — check current Resend docs for what that supports, since sandbox/testing allowances change).
3. Set `RESEND_API_KEY` in `.env`.
4. Set `EMAIL_FROM` to an address on your verified domain, e.g. `VaultFoundry <noreply@yourdomain.com>`.

This only wires up the magic-link email (`src/lib/auth/send-magic-link.ts`). It is **not** yet connected to campaign sending — that's a separate delivery provider (`src/lib/delivery/`) that still needs to be built.

### Cloudflare R2 (asset storage)

1. In the Cloudflare dashboard, go to **R2 → Create bucket**. Name it (e.g. `vaultfoundry-assets`) and note your **Account ID** (shown in the R2 overview / account home).
2. **R2 → Manage API tokens → Create API token** — grant it Object Read & Write access, scoped to the bucket you just created.
3. Copy the generated **Access Key ID** and **Secret Access Key**.
4. For public asset URLs, either enable the bucket's public development URL or attach a custom domain under the bucket's **Settings → Public access** — use whichever you configure as `R2_PUBLIC_BASE_URL`.
5. Fill in `.env`:
   ```
   STORAGE_PROVIDER=r2
   R2_ACCOUNT_ID=<account id>
   R2_ACCESS_KEY_ID=<access key id>
   R2_SECRET_ACCESS_KEY=<secret access key>
   R2_BUCKET=vaultfoundry-assets
   R2_PUBLIC_BASE_URL=<public bucket URL or custom domain>
   ```

With `STORAGE_PROVIDER` set to anything other than `r2` (or unset), uploads fall back to local disk (`data/uploads/`, served through `/api/assets/file`) — useful for dev without touching your bucket. `src/lib/storage/r2.ts` implements the `StorageProvider` interface (`src/lib/storage/types.ts`) against R2's S3-compatible API via `@aws-sdk/client-s3`; the provider is chosen once at first use in `src/lib/storage/index.ts`, so if you flip `STORAGE_PROVIDER` you'll need to restart the dev server. Uploaded object keys are prefixed with the uploader's organization ID (`{organizationId}/{year}/{hash}-{uuid}.ext`) for per-tenant isolation within the shared bucket.

---

## Architecture notes

- **Document model**: emails, templates, and blocks are all JSON trees of typed `EmailComponent` nodes (`src/lib/email/types.ts`), compiled to MJML then to HTML (`src/lib/email/render.ts`).
- **Multi-tenancy**: every resource is scoped to an `organizationId`. Sign-up auto-creates a workspace org and makes the new user its owner (`src/lib/auth/auth.ts`, `databaseHooks`).
- **Versioning**: blocks and templates keep an append-only history in `block_versions` / `template_versions`. Inserting a block into an email deep-clones its current component tree and stamps `meta.sourceBlockId/sourceBlockVersion` — later edits to the block never mutate emails that already used it.
- **Route protection**: `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) does a cookie-only optimistic auth check in front of all workspace routes; every API route additionally calls `requireSession()` server-side and scopes queries by the caller's `organizationId`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / run |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Start/stop local Postgres via Docker |
| `npm run db:push` | Push schema to the database directly (dev) |
| `npm run db:generate` / `db:migrate` | Generate and apply versioned SQL migrations |
| `npm run auth:generate` | Regenerate Better-Auth's Drizzle schema from `src/lib/auth/auth.ts` |
