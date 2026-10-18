# Production build and preview

Use the configured PostgreSQL database and runtime settings for the full
production build:

```sh
NODE_ENV=production pnpm build
```

This checks settings, generates the database client, checks the database and
deploys migrations, then builds all assets, packages and the Next application.
The postbuild lifecycle must also complete. Keep `SKIP_DB_CHECK` and
`SKIP_DB_MIGRATION` unset, including in dotenv files.

## Build concurrency on constrained runners

Next.js 16.3.4 derives its default build worker count from
`CIRCLE_NODE_TOTAL - 1`, falling back to the host CPU count minus one. When a
runner exposes more host CPUs than its allocation, use the existing environment
option to request four workers without changing application configuration:

```sh
CIRCLE_NODE_TOTAL=5 NODE_ENV=production pnpm build
```

This option is read by Next.js outside CircleCI too. It works with the pinned
dependency without a source patch. Confirm the effective count in the
`Collecting page data using … workers` output; recheck the option when upgrading
Next.js. An explicit `experimental.cpus` setting overrides this default.

A worker limit is not a memory guarantee. Exit 137 alone does not prove an OOM
kill. Correlate runner termination records or cgroup `memory.events` deltas with
the build before assigning a cause. Keep logs outside the source tree and
redact connection credentials before sharing. When comparing allocations, use
the same revision, database configuration and comparable cache state. Report a
passing allocation as sufficient, rather than as a measured minimum.

## Checks and preview

Retain the full build, lint, tests and any additional configured checks. The
repository CI also checks generated API contracts and workspace packages:

```sh
pnpm lint
pnpm openapi:generate
pnpm openapi:check --explicit
pnpm check:api:client
pnpm build:packages
pnpm test
pnpm test:packages
```

Review generated source changes, then build from the final inputs before
starting a production preview with the same database/runtime configuration:

```sh
NODE_ENV=production pnpm start
```

Use the assigned `PORT` and preview URL. Verify `/login`, `/script.js` and
`/recorder.js`, accounting for `BASE_PATH` and tracker rewrites. Check status,
content type and expected content at both the server and exposed preview URL.

With a disposable database or an account authorized for website CRUD, configure
the existing `UMAMI_USER`, `UMAMI_PASSWORD` and `UMAMI_USER_ID` settings and run:

```sh
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL="$preview_url" \
  pnpm exec playwright test tests/e2e/login.spec.ts tests/e2e/website.spec.ts --project=chromium
```

Set `preview_url` to the actual preview base URL first. These tests exercise
login/logout, validation and database-backed website CRUD. A served login page
alone does not demonstrate database-backed behavior.
