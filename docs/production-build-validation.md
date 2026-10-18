# Production build and preview validation

Use the standard build with the configured PostgreSQL database and runtime
settings. It checks settings, generates the database client, checks the database
connection and version, deploys migrations, and builds the tracker, recorder,
geo data, OpenAPI/client, workspace packages and Next application. The postbuild
lifecycle must also complete. `build:docker` or `build:app` alone does not exercise
this sequence.

## Diagnose a terminated build

Keep build output and resource measurements outside the source tree. Record the
revision, Node/pnpm versions, allocation and whether build caches already exist.
Do not dump environment variables or database URLs. Build output can contain
connection details on failure; redact credentials before sharing it.

Run the full build with neither `SKIP_DB_CHECK` nor `SKIP_DB_MIGRATION` set,
including in dotenv configuration. Capture its exit status directly, rather than
the status of a logging pipeline. For example, in a shell without `errexit`:

```sh
build_evidence=$(mktemp -d)
git rev-parse HEAD > "$build_evidence/revision"
node --version > "$build_evidence/node-version"
pnpm --version > "$build_evidence/pnpm-version"
NODE_ENV=production pnpm build > "$build_evidence/build.log" 2>&1
build_status=$?
printf '%s\n' "$build_status" > "$build_evidence/build.status"
cat "$build_evidence/build.log"
```

On Linux with cgroup v2, locate the process's cgroup using `/proc/self/cgroup`
and `/proc/self/mountinfo`. Inspect its accessible ancestors too: an ancestor can
impose a tighter limit. Capture these files before and after the build, and
sample memory usage during it:

- `cpu.max` and `cpuset.cpus.effective` for CPU quota and eligible CPUs;
- `memory.max`, `memory.current`, `memory.peak` and `memory.events`;
- `memory.events.local`, when available, to distinguish descendant events;
- `memory.swap.max` and `memory.swap.current`.

Use counter deltas or a fresh isolated cgroup to attribute an OOM event to this
run. A pre-existing memory peak is not this build's measured peak. Record other
processes sharing the allocation, and obtain runner timeout/termination records
or kernel OOM records when available. A kill can prevent the build shell from
writing its status; the supervising runner must retain diagnostics in that case.

Exit 137 alone does not identify the termination source. Correlated OOM-kill
events or runner diagnostics are needed to distinguish memory exhaustion from
an external kill. A successful later build also does not establish why an
earlier build failed.

`next.config.ts` explicitly sets `experimental.cpus: 4` to constrain Next build
workers when the host CPU count exceeds the runner allocation. Confirm the
effective count in Next's `Collecting page data using … workers` output. This
setting is not a memory guarantee. Do not change application rendering or skip
checks to accommodate a runner. If allocation comparisons are needed, use the
same revision, full command, database configuration and comparable cache state,
varying one factor at a time. Report a passing allocation as demonstrated
sufficient, rather than as a minimum without boundary measurements.

## Checks and production preview

The repository CI checks are:

```sh
pnpm openapi:generate
pnpm openapi:check --explicit
pnpm check:api:client
pnpm build:packages
pnpm test
pnpm test:packages
```

Preserve any additional checks configured by the owning runner. Its validation
stage should execute these when it owns check results. Do not copy CI's
`SKIP_DB_CHECK=1` into the database-enabled production build. Review generated
source changes before rebuilding and starting a preview from the final inputs.

After a successful full build, start the production server with the same
database/runtime configuration:

```sh
NODE_ENV=production pnpm start
```

Use the assigned `PORT` and preview URL. Request `/login`, `/script.js` and
`/recorder.js`, accounting for `BASE_PATH` and any configured tracker rewrites.
Check status, content type and expected content at both the server and exposed
preview URL. Retain the startup output and artifact/revision identity outside
the source tree.

With an authorized test account and the existing `UMAMI_USER`, `UMAMI_PASSWORD`
and `UMAMI_USER_ID` settings, target the running production preview using the
existing Playwright overrides:

```sh
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL="$preview_url" \
  pnpm exec playwright test tests/e2e/login.spec.ts tests/e2e/website.spec.ts --project=chromium
```

Set `preview_url` to the actual preview base URL first. These tests exercise
login/logout, validation and website CRUD against the database. Use a disposable
test database or an account authorized for those changes. A served login page
alone does not demonstrate database-backed behavior. Retain results externally
and distinguish build, checks, termination diagnosis and preview evidence;
unexecuted stages remain unverified.
