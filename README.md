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
| Contacts | Working — CRUD, org-scoped |
| Sending | Working for one-off/small-group sends via the builder's "Send" button (`getDeliveryProvider()` now backed by Resend). Recipients not already a contact get auto-created as one. No scheduling, no bulk campaign list/management UI yet — that's still the `/campaigns` placeholder. |
| Campaigns page | Placeholder screen — quick-sends already write into the `campaigns`/`campaignRecipients` tables underneath, so a future campaigns list can surface this history, it just isn't built yet. |

## Prerequisites

- Node.js 20+
- Docker (or Podman with the Docker CLI shim) — for local Postgres in dev, or to run the whole stack in containers. See [Running the whole stack in containers](#running-the-whole-stack-in-containers) below.

## Quick start (host dev)

This runs the Next.js dev server directly on your machine against a containerized Postgres — fastest iteration loop, hot reload included.

```bash
npm install
cp .env.example .env        # then fill in values — see below
npm run db:up                # starts local Postgres via Docker
npm run db:push              # applies the schema
npm run dev
```

Visit `http://localhost:3000/sign-in`. With no `RESEND_API_KEY` set, magic links are printed to your terminal instead of emailed — copy the URL from the server log into your browser to sign in. The first sign-in auto-creates a workspace (organization) and makes you its owner.

If you want the app itself running in a container too (matching production), skip to [Running the whole stack in containers](#running-the-whole-stack-in-containers).

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

This same `RESEND_API_KEY` also powers actual email sending: magic-link/invitation emails (`src/lib/auth/email.ts`) and the builder's "Send" button (`src/lib/delivery/resend.ts`, selected via `DELIVERY_PROVIDER=resend`) are separate code paths that both read this one key.

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

## Running the whole stack in containers

`docker-compose.yml` at the repo root runs the app (built from the included `Dockerfile`, multi-stage, Next's `output: "standalone"`) and Postgres. This is the deployment-shaped setup — use it on a real host (e.g. an RHEL box behind Caddy), not just local dev. The `npm run docker:*` scripts shell out to **`podman-compose`** (not `docker compose`) — adjust them if you're actually on Docker.

```bash
cp .env.example .env        # fill in real values — this is what the app container reads
npm run docker:build         # podman-compose build
npm run docker:up            # podman-compose up -d
npm run docker:db:push       # podman-compose run --rm migrate — applies the schema (first run and after any schema change)
npm run docker:logs          # podman-compose logs -f app
```

The app listens on **`127.0.0.1:6567`** on the host — loopback only, not exposed to the network directly. Point your reverse proxy at it. A minimal Caddyfile entry:

```
mail.yourdomain.com {
  reverse_proxy 127.0.0.1:6567
}
```

Set `BETTER_AUTH_URL` in `.env` to that public URL (`https://mail.yourdomain.com`) before starting the stack — it's what both the Google OAuth redirect and magic-link URLs are built from, and better-auth will reject requests whose `Origin` doesn't match it. Env vars are read at container start, not baked into the image, so changing `.env` only needs a restart (`podman-compose down && podman-compose up -d`), not a rebuild. If Caddy runs on a different host or its own container/network and can't reach `127.0.0.1` on this machine, change the `app.ports` binding in `docker-compose.yml` accordingly (e.g. drop the `127.0.0.1:` prefix, or attach both to a shared network and skip publishing a host port entirely).

**Postgres is not exposed to the host at all** — no `ports:` entry on that service. Only the `app` container can reach it, over the internal compose network at `postgres:5432`.

**Schema pushes/migrations run via a separate `migrate` service**, not inside `app` — the `app` image is Next's pruned standalone build and deliberately never has `drizzle-kit` or any devDependencies in it. `migrate` instead builds from the Dockerfile's intermediate `builder` stage (full toolchain) and only runs when invoked explicitly:

```bash
npm run docker:db:push       # podman-compose run --rm migrate
npm run docker:db:migrate    # podman-compose run --rm migrate npm run db:migrate
```

Run `docker:db:push` once after the first `docker:up` (a fresh Postgres has no tables at all — every write, including a magic-link sign-in, will 500 until this has run) and again after any schema change.

### SELinux (RHEL 10.1 and similar)

Both bind-mounted volumes carry the `:Z` SELinux label:

```yaml
volumes:
  - ./data/postgres:/var/lib/postgresql/data:Z    # postgres service
  - ./data/uploads:/app/data/uploads:Z             # app service
```

`:Z` relabels the host directory for exclusive use by the mounting container (as opposed to `:z`, shared across multiple containers) — required under SELinux-enforcing hosts or the container will get `Permission denied` trying to write to it. Named/managed Docker volumes don't need this (the engine sets their SELinux context automatically); it's specifically bind mounts of host paths — like both of these — that need it spelled out.

If Postgres still fails to start with a permissions error the first time, it's almost always host-directory ownership rather than SELinux — the bind-mount target must be writable by the `postgres` container's internal UID (999 in the official image):

```bash
sudo chown -R 999:999 data/postgres
```

`data/uploads` is only actually written to when `STORAGE_PROVIDER` is unset or not `r2` (see [Cloudflare R2](#cloudflare-r2-asset-storage)) — with R2 configured it stays empty, but the mount and its label are harmless either way.

### Local dev against the containerized DB

Because Postgres has no published port in the committed `docker-compose.yml`, host-based `npm run dev` (the [Quick start](#quick-start-host-dev) above) can't reach a database brought up via `npm run docker:up`. If you want hot-reloading host-side dev against a container Postgres you can still reach, add a git-ignored `docker-compose.override.yml` with:

```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"
```

Compose merges override files automatically, so this never touches the committed file or the "don't expose the database" behavior of the base setup — it only affects your own machine.

---

## Architecture notes

- **Document model**: emails, templates, and blocks are all JSON trees of typed `EmailComponent` nodes (`src/lib/email/types.ts`), compiled to MJML then to HTML (`src/lib/email/render.ts`).
- **Multi-tenancy**: every resource is scoped to an `organizationId`. Sign-up auto-creates a workspace org and makes the new user its owner (`src/lib/auth/auth.ts`, `databaseHooks`).
- **Versioning**: blocks and templates keep an append-only history in `block_versions` / `template_versions`. Inserting a block into an email deep-clones its current component tree and stamps `meta.sourceBlockId/sourceBlockVersion` — later edits to the block never mutate emails that already used it.
- **Route protection**: `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) does a cookie-only optimistic auth check in front of all workspace routes; every API route additionally calls `requireSession()` server-side and scopes queries by the caller's `organizationId`.
- **Team invites**: `/settings` (owner/admin only for the management actions) uses Better-Auth's organization plugin directly — invite, role change, remove, and cancel-invitation all go through `authClient.organization.*`, not custom API routes. Invitation emails reuse the same Resend pipeline as magic-link sign-in (`src/lib/auth/email.ts`). An invitee who isn't signed in yet gets bounced through `/sign-in?next=/accept-invitation?id=...` and lands back on the invitation automatically — `proxy.ts` sets `next`, the sign-in page threads it through as `callbackURL`. Note: since every new sign-up also auto-creates its own personal workspace, an invited user who didn't already have an account ends up a member of two organizations; there's no org switcher yet, so which one is "active" depends on Postgres row order in `session.create.before` — a real switcher is the natural next step if that becomes a problem.
- **Rows and columns inside a section**: a section's children are still a flat list of `column` nodes — there's no separate "row" node in the data model. `src/lib/email/layout.ts`'s `groupColumnsIntoRows` buckets consecutive columns into rows by their `width` percentages adding up to ~100%; "Add row" just appends another 100%-width column, which naturally starts a new bucket. Both the canvas (`builder.tsx`) and the real MJML output (`render.ts`) group children the same way, so they always agree. One MJML constraint shaped this: `mj-wrapper` can't nest inside another `mj-wrapper`, and the document already wraps every section in one for the page's content background — so multiple rows can't share a literal wrapper element. Instead every row becomes its own `mj-section` with the same background color and no gap between them (vertical padding only on the first/last row), which reads as one seamless block despite being separate elements under the hood.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / run |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Start/stop local Postgres via Docker (host dev) |
| `npm run db:push` | Push schema to the database directly (dev) |
| `npm run db:generate` / `db:migrate` | Generate and apply versioned SQL migrations |
| `npm run auth:generate` | Regenerate Better-Auth's Drizzle schema from `src/lib/auth/auth.ts` |
| `npm run docker:build` | Build the app image (`podman-compose build`) |
| `npm run docker:up` / `docker:down` | Start/stop the full app + Postgres stack |
| `npm run docker:logs` | Tail the app container's logs |
| `npm run docker:db:push` / `docker:db:migrate` | Push/migrate the schema via the one-off `migrate` service |
