# Current TradingView MCP architecture

This describes the implementation landed in [PR7](https://github.com/naopi1213777/tradingview-mcp/pull/7)
for [mission #4](https://github.com/naopi1213777/tradingview-mcp/issues/4).
The dependency assessment is in [dependency verification](dependency-verification.md).
The former planned design remains readable in PR5's approval history.

## Runtime and ownership

The existing client starts `node /Users/mn/codex/mcp-tools/tradingview-mcp/src/server.js`
from the user's fork main. MCP uses stdio; page operations use the existing
loopback CDP endpoint, normally `127.0.0.1:9222`. The supported Node minimum is
18.14.1. Runtime dependencies are SDK 1.31.0, chrome-remote-interface 0.33.3 and
zod 4.3.6, with the exact transitive graph and registry integrities in the lock.
Installation uses `npm ci --ignore-scripts`. No permanent alternate registration,
runtime copy, provider assignment or MCP path was introduced by this mission.

Existing registrations in Trading Skills Lab and trading-skills point at that
canonical command. Their owners retain configuration, authentication and restart
control. A main update or a separate SDK subprocess does not reload an already
running registered server. Future fork updates retain normal Git history; an
application rollback uses an independently reviewed correction/revert and the
affected client's restart, not a reset of main or a second runtime.

Dependencies execute as the local user. The bridge does not patch TradingView,
but CDP controls an authenticated app. Page actions can make normal authenticated
TradingView requests; arbitrary evaluation can also access credential-bearing
state, send other network requests and change saved state. Requested outputs
reach the authorized client and potentially its selected AI provider. Minimize
output; never publish credentials or full proprietary Pine source. Loopback and
URL classification are useful controls, not a sandbox or a read-only guarantee.

## Target selection and launch

`src/targets.js` shares parsed chart eligibility across the connection, tab and
Pine helper paths. A chart must be a page with a valid target ID, HTTPS on exact
`tradingview.com`, `www.tradingview.com` or `jp.tradingview.com`, no userinfo or
non-default port, and `/chart/` or one layout path beneath it. Query text and
lookalike domains do not establish eligibility. One chart is selected only when
unambiguous; `TV_CDP_TARGET_ID` or an explicit tab operation can select one exact
eligible target. Duplicate or invalid IDs are rejected. A connected target's
current metadata is checked before evaluation; disappearance or navigation
does not silently replay work on another chart.

App shell and new-tab file pages are separate classes, constrained by installed
resource paths and the expected DOM capability. They are not chart targets.
Unsupported shell identity holds the affected tab operation. Exact tab activation
failure does not cause ordinal hunting. `TV_CDP_HOST`/`CDP_HOST` and
`TV_CDP_PORT`/`CDP_PORT` remain operator inputs; malformed or out-of-range ports
are errors. This deployment enables no remote CDP destination.

`tv_launch` and the CLI launcher remove inherited `ELECTRON_RUN_AS_NODE` only
from a cloned app-child environment. They preserve the parent and other
variables. Default startup is non-killing: it reuses a verified debug endpoint
or reports a running non-debug conflict. A spawned PID without CDP readiness is
`success:false`. Explicit `kill_existing:true` is destructive and is also required
for Windows Store local-copy fallback; that fallback was not exercised here.
The legacy `scripts/launch_tv_debug*` wrappers still terminate existing app
processes and do not have the guarded launcher's behavior. Use the guarded
launcher or deliberate manual startup; never kill a shared/unknown process to
establish a test baseline.

## Data and saved-editor contracts

Strategy metrics retain snake_case fields, including `metrics.net_profit`,
`total_trades`, `percent_profitable`, `profit_factor` and `max_drawdown`.
An ambiguous strategy requires exact `entity_id`. Default `prepare:false` does
not open the tester or unhide strategies. Explicit preparation affects only the
selected strategy and reports effects even if a later read fails. Unknown
effects remain unknown (`null` effect booleans), rather than confirmed absence.
Inspect partial/unknown effects before any subsequent mutation; there is no
automatic retry or rollback. Missing reports are unavailable, never synthetic
zero metrics. Trades are limited to at most 20 returned orders per read; a
missing equity curve remains unavailable even when buy-and-hold data exists.
The bounded consumer search found no required legacy camelCase caller, so no
aliases or other-repository consumer edits were added.

`pine_open` selects an exact saved ID/version (or an exact unique name), reads
the saved source, and uses the app's native saved-version opener. It requires
one already-displayed clean, non-draft editor with known saved identity and no
confirmation. It verifies current/saved source equality before mutation and
the actual requested editor ID/version/source afterward. It never substitutes
source injection, compilation, save or a new draft. The result includes safe
digests and previous identity/view state for deliberate restoration. A native
failure may be partial; inspect it without blind retry, save or discard.
Private editor APIs may change with TradingView updates.

Labels retain the default 50-per-study limit, explicit `max_labels`, filter and
total/eligible/returned/truncation fields. They are not deduplicated; verbose IDs
and coordinates distinguish records. Existing eight-decimal price rounding is
preserved, not a promise of tick-size accuracy. Tables retain formatted rows and
add table IDs and indexed cells, including returned blanks. Missing positions,
decoration and timeframe identity cannot be inferred from strings. This is not
a DW-wide display/indicator or source-version correspondence verification.

## Applied evidence and remaining limits — 2026-10-17

The child was independently reviewed and [completed](https://github.com/naopi1213777/tradingview-mcp/issues/6#issuecomment-6228493938)
after PR7 at `8f0fbd998fbaa0b843499e0c32934a195c735ec4` merged as
`6ff5b31bafeb61236439d34d0ec1d36d02351c64`. Canonical main received the reviewed
lock, scripts-disabled installation and valid npm tree. Lock SHA-256 is
`0066b396b195fd49ba625e8ffcbeb64c98043c5f03bca5b80afda0c3592548aa`.
The dated dependency record distinguishes offline checks, public Pine sample
compilation and registry advisory results from actual app/client evidence.

The child's bounded actual T3 Codex-to-canonical-SDK-stdio check listed 84 tools,
reused the existing debug app without a new spawn, and verified the intended
saved chart on `jp.tradingview.com`, FX:USDJPY/5. Both user-selected Method 1
and Method 2 returned 19 numeric snake_case metrics with `prepare:false`, and
20 of 39 / 20 of 514 orders respectively. Equity was unavailable for both;
quote, eight labels and five indexed table cells (four blank) were available.
These are dated observations on that target and TradingView macOS 3.4.1.8194,
not universal indicator/field availability or current live-state guarantees.

Native saved-open Method 1@11.0 → Method 2@12.0 → Method 1@11.0 verified
saved/editor source equality and restoration of identity, source, clean state,
full view, panel, studies and persistence. The earlier immediate folding-state
comparison failed; a subsequent read-only settling observation and the later
roundtrip remain distinct evidence, not a rewritten initial success. These
private-API checks do not repair the old August source/restoration uncertainty.

The user deliberately added both Methods to the existing chart, displayed Pine
and accepted possible layout autosave to cloud. That composition is retained;
it is not a temporary AI placement or a guarantee of unchanged cloud state.
No script-body edit, save or publication was selected. A restart or Git revert
does not undo an already-saved layout or other account effects.

**Still required:** existing-owner reload of the affected registered MCP client
and actual T3 Claude-environment launch/connection/needed-data verification.
The available Claude provider reported unauthenticated. Codex SDK/CLI or a
synthetic environment is not that check. The existing Manager/GM operator
request owns the next action and any human authentication/access/cost decision.
Do not duplicate it or change runtime paths or credentials. This missing actual
client evidence holds the parent execution check/completion; independent
integration and PR review continue. Historical post-L3 execution violations and
source/retention gaps remain in canonical review records for the mission audit;
prospective approval and current measurements do not erase them.
