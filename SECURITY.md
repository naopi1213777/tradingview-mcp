# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Email:** Open a private security advisory via [GitHub Security Advisories](https://github.com/tradesdontlie/tradingview-mcp/security/advisories/new).

**Do not** open a public issue for security vulnerabilities.

## Scope

This project connects to a locally running TradingView Desktop instance via Chrome DevTools Protocol on `localhost:9222`. Security concerns in scope include:

- Code injection via crafted tool inputs
- Unintended data exposure through tool outputs
- Credential or session token leakage
- Vulnerabilities in the MCP server or CLI that could be exploited locally

## Out of Scope

- TradingView's own security (report to TradingView directly)
- Chrome DevTools Protocol security (report to Google/Chromium)
- Claude Code or MCP SDK security (report to Anthropic)

## Best Practices for Users

- Only run TradingView with `--remote-debugging-port=9222` on localhost
- Do not expose port 9222 to your network or the internet
- Do not pipe `tv stream` output to external services without reviewing the data
- Keep your TradingView Desktop and Node.js installations up to date

## Dependency Audit

Introduced 2026-07-29 (Notion task `3a165cd1-7da6-8133-b7a9-cf1ebf6fbe22`).
`package-lock.json` is the canonical lockfile. Note: `npm audit` sends
dependency information to the npm registry and requires network access.

Commands are separated by role — do not slide from detection into updating:

1. **Detect only (read-only):** `npm audit --audit-level=high`
   - Stop condition: non-zero exit (high or critical findings) → stop
     dependency-related work and report to the user. Findings already recorded
     in the exceptions table below are reported as known.
2. **Lockfile consistency (read-only):** `npm ci --dry-run`
3. **Approved update only:** `npm audit fix` (semver-compatible; run only
   within an approved task). Major updates require explicit user approval.

Cadence: on any dependency/lockfile change, plus a monthly manual run.
Owner: Claude Code (on the user's monthly request or at the start of the
month's first dependency-related task; results go to the daily log). If a
month is missed, the next run records the gap in the daily log and must run.
No CI or resident service is added for auditing (decision of 2026-07).
Rollback: `git revert` the lockfile change, then `npm ci`.

### Dependency Audit Exceptions (unresolved known risks)

Initial audit 2026-07-29: 8 vulnerable packages (1 low / 4 moderate / 3 high).
These are unresolved known risks, not false positives. Remediation owner:
Claude Code, via semver-compatible updates in follow-up Notion task
`3ac65cd1-7da6-81d0-b564-f10b18318bf3` (re-check when that task completes).
Updated 2026-07-29 (execution-check re-audit): added GHSA-w62v-xxxg-mg59
(hono, moderate, published after the initial table was written). New
advisories detected by a later audit are appended here the same way.

| Package | Severity | Vulnerable range | Advisory IDs |
|---|---|---|---|
| ws | high | 7.0.0 - 7.5.10 | GHSA-96hv-2xvq-fx4p |
| hono | high | <=4.12.26 | GHSA-26pp-8wgv-hjvm, GHSA-r5rp-j6wh-rvv4, GHSA-xf4j-xp2r-rqqx, GHSA-wmmm-f939-6g9c, GHSA-xpcf-pg52-r92g, GHSA-qp7p-654g-cw7p, GHSA-hm8q-7f3q-5f36, GHSA-p77w-8qqv-26rm, GHSA-9vqf-7f2p-gf9v, GHSA-69xw-7hcm-h432, GHSA-xrhx-7g5j-rcj5, GHSA-3hrh-pfw6-9m5x, GHSA-f577-qrjj-4474, GHSA-2gcr-mfcq-wcc3, GHSA-458j-xx4x-4375, GHSA-rv63-4mwf-qqc2, GHSA-wgpf-jwqj-8h8p, GHSA-88fw-hqm2-52qc, GHSA-wwfh-h76j-fc44, GHSA-j6c9-x7qj-28xf, GHSA-xgm2-5f3f-mvvc, GHSA-hvrm-45r6-mjfj, GHSA-w62v-xxxg-mg59 |
| fast-uri | high | <=3.1.3 | GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc, GHSA-v2hh-gcrm-f6hx, GHSA-4c8g-83qw-93j6 |
| @hono/node-server | moderate | <=2.0.4 | GHSA-92pp-h63x-v22m, GHSA-frvp-7c67-39w9 |
| ip-address | moderate | <=10.1.0 | GHSA-v2v4-37r5-5v8g |
| qs | moderate | 6.11.1 - 6.15.1 | GHSA-q8mj-m7cp-5q26 |
| express-rate-limit | moderate | (transitive) | via ip-address |
| body-parser | low | 2.0.0 - 2.2.2 | GHSA-v422-hmwv-36x6 |
