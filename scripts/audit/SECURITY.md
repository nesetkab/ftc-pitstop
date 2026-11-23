# Security and abuse review, November 2026

PitStop has no accounts. Everything is public and read-only except shared workspaces, which are
guarded only by a 6-character join code. So the risks that matter are:

1. **Injection into what we serve**: hostile team or event names from FTC or FTCScout ending up
   as script in HTML, SVG badges, OG cards, ICS feeds, CSV exports or JSON-LD.
2. **Cost abuse**: requests that skip the CDN cache and make the function render, or that spend
   Redis commands. Redis is a shared Upstash database with 500K commands a month and limited
   storage, so every write per request is a budget leak for both apps.
3. **Workspace takeover or spam**: guessing codes, flooding writes, filling Redis storage.
4. **Leaks**: secrets in client bundles, error bodies or logs.

## What is in place

| Area              | Defence                                                                                                                                                                                                                                                          | Tests                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Headers           | nosniff, DENY framing, COOP, referrer and permissions policy on every answer; hashed-script CSP on pages; `default-src 'none'` CSP on everything else (SVG, CSV, ICS, JSON)                                                                                      | `tests/data/security.test.ts`                                                |
| HTML and JSON-LD  | Svelte escaping; the only `{@html}` is JSON-LD with `<`, `>`, `&`, U+2028/9 escaped                                                                                                                                                                              | `src/lib/seo.test.ts`                                                        |
| SVG badges        | `escapeXml` plus removal of invalid XML and bidi controls                                                                                                                                                                                                        | `src/lib/server/badge/svg.test.ts`                                           |
| ICS and CSV       | ICS text escaping and folding; CSV quotes plus a `'` before cells starting `= + - @` tab or CR; filenames only from validated codes                                                                                                                              | `src/lib/server/calendar/ics.test.ts`, `src/lib/server/csv.test.ts`          |
| Paths and codes   | Event codes, team numbers and OG paths are matched against strict patterns; unknown event codes are checked against the season list before any upstream call                                                                                                     | `tests/data/api-input.test.ts`, `tests/data/og.test.ts`                      |
| Redirects         | Every redirect target is rebuilt from parsed numbers or codes, never echoed; leading slashes are collapsed so `//host` cannot appear                                                                                                                             | `tests/data/query-canonical.test.ts`, `tests/data/legacy.test.ts`            |
| CDN cache keys    | Endpoints redirect (308, cached) any query that is not the one the site itself builds: unknown or repeated keys, junk values, reordered team lists. Covers `/og`, badges, CSV exports, ICS, `/api/*`, `season.json`, the sitemap, and `/compare` and `/simulate` | `tests/data/query-canonical.test.ts`                                         |
| Workspace guesses | 30 misses per 10 minutes per address (IPv6 grouped by /64, last forwarded hop only). Once refused, the instance stops asking Redis until the window ends                                                                                                         | `tests/data/workspace-budget.test.ts`, `tests/data/workspace-routes.test.ts` |
| Workspace writes  | Same-origin JSON only, byte caps per document, 90 writes a minute per workspace, refusals answered from memory                                                                                                                                                   | `src/lib/workspace/api.test.ts`, `tests/data/workspace-budget.test.ts`       |
| Workspace storage | 10 new workspaces an hour and 30 a day per address, 400 a day site-wide; each document capped (boards 300 KB, others under 60 KB)                                                                                                                                | `src/lib/workspace/api.test.ts`                                              |
| Errors and logs   | Error bodies are fixed strings; logs go through `describeError`, which redacts secrets and URLs                                                                                                                                                                  | `tests/data/security.test.ts`, `tests/data/redis-secrets.test.ts`            |
| Secrets           | Only `$app/env/private` reads them; the client build was scanned for every `.env.local` value with no hits                                                                                                                                                       | `tests/data/env-boundary.test.ts`, `tests/data/secrets.test.ts`              |
| Redis budget      | Per-page command counts are pinned                                                                                                                                                                                                                               | `tests/data/redis-budget.test.ts`, `tests/data/workspace-budget.test.ts`     |

## Known gaps

- **A join code is the whole key.** Anyone who has it can overwrite every document, including
  wiping them. They cannot delete the workspace itself. This is by design; there is no undo on the
  server.
- **Determined abuse can still spend the budget.** A holder of one join code can write 90 times a
  minute, and many addresses can each make their 30 workspaces a day. The caps bound it; they do
  not stop it. A Vercel firewall rate-limit rule on `/api/workspace` is the next step if this
  ever happens.
- **Some renders are uncached by nature.** Replay mode (`?replay=1&at=`) and the `pitAnalysis`
  remote function rerun the model for each distinct time, and OG cards for arbitrary compare or
  simulate line-ups render once per line-up. These cost CPU only, no Redis.
- **Crawling every team** writes each real team to Redis once per cache lifetime (5 minutes to 6
  hours). Search engines do this too; it is bounded by the number of real teams.
