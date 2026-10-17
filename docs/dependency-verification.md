# Dependency verification for mission #4 / child #6

Observed 2026-10-17 with Homebrew Node 26.4.0 and npm. This records the bounded
implementation evidence; it is not evidence of completed live application or
an actual T3 Claude-client test.

## Resolution and provenance

Direct runtime dependencies are pinned to SDK 1.31.0,
chrome-remote-interface 0.33.3 and zod 4.3.6; ESLint stays 9.39.4. zod was already
in the runtime graph and directly imported by tool modules. Source metadata
identifies modelcontextprotocol/typescript-sdk, cyrus-and/chrome-remote-interface
and colinhacks/zod. Registry tarball URLs and SHA-512 integrities are committed
in `package-lock.json`; `npm ci --ignore-scripts` verified the distributables
against that lock. Registry integrity establishes matching bytes, not benign
behavior or independent provenance verification. No install lifecycle was run.

The selected changed transitive versions are:

| Package | Locked version | Reason |
| --- | --- | --- |
| @hono/node-server | 1.19.15 | Approved fixed 1.x line; SDK accepts it |
| body-parser | 2.3.0 | Compatible middleware fix |
| content-type beneath body-parser and type-is | 2.1.0 | Upstream-declared compatible 2.x closure |
| type-is | 2.1.0 | Required by body-parser 2.3.0 |
| fast-uri | 3.1.8 | Compatible fix |
| hono | 4.13.13 | Compatible fix |
| ip-address | 10.7.4 | Compatible fix |
| proxy-addr | 2.0.8 | Compatible fix |
| qs | 6.16.1 | Compatible fix |
| brace-expansion | 1.1.21 | Compatible lint closure fix |
| js-yaml | 4.3.2 | Compatible lint closure fix |

content-type 1.0.5 remains resolved for SDK/Express consumers declaring 1.x;
2.1.0 is nested for the consumers declaring 2.x. No override forces one API
onto both sets. The resolver initially selected node-server 2.1.5; before
installation its entry was replaced with official 1.19.15 metadata/integrity,
within the SDK's admitted range, preserving the existing major and avoiding
that 2.x release's Node >=20 requirement. No persistent override or additional
direct dependency was introduced. `npm ls --all --json` exited 0 with valid
ranges. Runtime minimum is Node 18.14.1 (node-server); ESLint development checks
require its existing supported Node range (18.18+, 20.9+, or 21.1+).

Versioned primary metadata:
[SDK](https://registry.npmjs.org/@modelcontextprotocol/sdk/1.31.0),
[body-parser](https://registry.npmjs.org/body-parser/2.3.0),
[content-type](https://registry.npmjs.org/content-type/2.1.0),
[node-server](https://registry.npmjs.org/@hono/node-server/1.19.15).

## Applicability and executed checks

`npm audit --json --ignore-scripts` exited 0, reporting zero advisories across
the 175 installed packages. That is the registry's dated affected-version
assessment, not evidence that the application is secure or that past exposure
has been resolved. ws remains at the already-fixed 7.5.11.

The SDK's [OAuth-client advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h)
excludes SDK servers and stdio clients. This server uses McpServer and
StdioServerTransport, with no OAuth client. HTTP middleware packages are
transitive; this stdio entry point exposes no HTTP middleware listener.
In-memory tests exercise JSON/text/urlencoded parsing, malformed media type,
invalid JSON and supported/unsupported charsets, plus actual resolved
content-type major coexistence. No HTTP application was started for that test.

The existing unit suite and focused boundary tests exercise actual SDK stdio
initialize/list/call and schema compatibility, fake-CDP cached-navigation
refusal, parsed target eligibility/ambiguity, child environment isolation,
non-killing launch/reuse/conflict/failure results, exact strategy selection and
preparation effects, missing metrics, label limits/precision and indexed blank
table cells. These are offline transport/simulation checks except the existing
unit suite's public Pine sample compilation checks. They are not account E2E
or actual-client evidence. Lint reports no errors and four pre-existing
warnings.

Runtime remains ordinary local-user execution. Dependencies are not a sandbox;
CDP controls an authenticated app and arbitrary evaluation can access page
credentials, transmit data and affect saved state. Installation downloads from
the official npm registry; ordinary runtime uses the existing localhost CDP and
TradingView destinations. No elevation, auth/config change, new telemetry,
runtime copy or registration-path switch is introduced. The dated subsequent
saved-script identity/restoration and Codex SDK application
observations, along with still-pending registered-client reload and actual T3
Claude-host evidence, are distinguished in [current architecture](architecture.md).
