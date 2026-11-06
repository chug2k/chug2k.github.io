# Private writing room

The public blog stays on GitHub Pages. A Cloudflare Worker handles only `clpanic.com/admin*`: authenticated static requests continue to the existing origin, while `/admin/api/*` serves the private writing library. A SQLite Durable Object holds drafts, revision history and idempotent save receipts; a private R2 bucket holds photos. Publishing goes through the Worker to the fixed `chug2k/chug2k.github.io` repository on `main`.

The Worker verifies Cloudflare Access JWT signatures, issuer, application audience, expiration and the exact allowed email (`cl@clpanic.com`). There is no authentication bypass, development identity or public bucket in the Worker. Browser writes require same-origin requests and a custom header. No secret belongs in the browser bundle or this repository.

## Deploy

Use Node 24.22.0 or later, `npm ci`, and the Cloudflare `cf` CLI included here. The project uses `cloudflare.config.ts` and Vite; it does not use a Wrangler configuration.

1. Sign into the Cloudflare account that owns `clpanic.com` with `npx cf auth login --no-browser`. Inspect the existing zone, DNS proxy state, Zero Trust organization, identity providers, applications and reusable policies before making changes.
2. Create a reusable Access **Allow** policy including only the email `cl@clpanic.com`. Attach its ID to a self-hosted application covering `clpanic.com/admin` and all descendants. Do not add bypass/everyone policies. Prefer a Google identity provider if configured; Cloudflare's email one-time-code provider also works without Google OAuth client credentials. The application and the Worker both enforce the same email allowlist.
3. Record the application's audience tag and the organization issuer (`https://TEAM.cloudflareaccess.com`) in `cloudflare.config.ts`. These are identifiers, not credentials; this deployment's values are already configured. Provide `GITHUB_TOKEN` through a private secrets file. The GitHub token must be fine-grained, scoped only to this repository, with Contents read/write. Use the BB secure secrets form rather than chat or shell arguments. `.env.deploy` and `.dev.vars` are ignored. Never commit or print them.
4. Run `npm test` and `npx cf deploy --dry-run`. The new bucket is private; do not enable an R2 public domain. Deploy with `npx cf deploy --secrets-file .env.deploy`. This provisions the declared Durable Object/R2 bindings and the `/admin*` route. The zone's apex record must be proxied for Workers routes to run; preserve its existing origin and TLS settings.
5. After enabling the proxy, verify unauthenticated requests to `/admin/` and `/admin/api/session` require login and the public homepage and articles still load. Deploy the matching `admin/` bundle to GitHub Pages, then verify the allowed author can save a draft and photo and open both from another device. Check that a different email is denied.

Access provisioning is account-specific and is intentionally not an unconditional script that replaces existing organization policies. `cf cli search` and `cf schema` expose the current Access API commands. The allowlist is a reusable account policy, attached by ID, rather than a legacy application-scoped policy.

## Data and recovery

The server compares each save's base revision inside one SQLite transaction. Stale writers create a recovery fork; the latest version is never overwritten. A compact receipt ties each mutation ID to the exact input and server-assigned fields, so an accepted write with a lost response can be retried safely without storing another full article per keystroke. The latest 100 revisions per draft are retained in the `revisions` table; receipts continue to reconcile older exact retries. The browser keeps a durable recovery outbox before contacting the server, reconciles uncertain requests before newer text, and imports old local drafts without deleting them.

Photos are uploaded before a draft can be acknowledged, use immutable IDs/content hashes and remain behind Access. Only an explicit publication copies referenced photos to the public GitHub repository. A failed upload/save leaves a visible pending state and a local recovery copy. The app needs a network connection and a valid session to open its library on a fresh page; it is not a fully offline web application.

The cloud backend does not permanently delete drafts or photos. Archive is reversible. Full ZIP backups remain available in the editor. Sign-out ends the Access session but retains local recovery data on that device; use a trusted browser profile.

## Checks

`npm test` runs in Cloudflare's Workers runtime, including SQLite/R2, JWT checks, CSRF, body limits, conflicts, idempotency and object eviction. `node ../admin/tests/cloud.cjs` exercises real browser IndexedDB/Web Locks and the editor against a mocked remote API. The original browser suite continues to probe visual editing and publication failure modes with isolated local fixtures. All tests use synthetic data and mocked external services.
