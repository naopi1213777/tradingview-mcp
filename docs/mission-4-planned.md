# Mission #4 planned design

Parent: https://github.com/naopi1213777/tradingview-mcp/issues/4

This is the proposed design, not implementation or an approval. The filed
parent remains the requirements source. The design PR stays unmerged until
all children are closed; the Parent Implementer then integrates the actual
outcome into current documentation. Manager changes only this document.

## Observed baseline and intended result

On 2026-10-17 the clean canonical `main`, `origin/main` and HEAD were
`33173813fe9e37a8b8f892b62457b9c622c2b048`. The fork origin is
`naopi1213777/tradingview-mcp`; the native project's upstream identity does
not change that destination. Installed TradingView is macOS 3.4.1.8194;
the available Homebrew Node is v26.4.0. No CDP listener responded on
127.0.0.1:9222 during read-only preparation. No application was launched.

The installed and locked SDK is 1.27.1 and chrome-remote-interface is 0.33.3.
The lock already contains ws7.5.11, @hono/node-server1.19.14, fast-uri3.1.3,
hono4.12.27, ip-address10.2.0 and qs6.15.3. The October8 versions are history,
not today's package inventory. A fresh `npm audit --json --ignore-scripts`
returned producer exit1: ten affected packages (one critical, five high,
three moderate, one low), including development-only lint dependencies.

The existing user-local Claude registration has the same stdio `node
/Users/mn/codex/mcp-tools/tradingview-mcp/src/server.js` command under
`/Users/mn/codex/trading-skills-lab` and `/Users/mn/codex/trading-skills`;
neither entry has environment overrides. No registration exists in that
configuration's TradingView MCP project entry. These entries and their other
settings are preserved. No registration/runtime copy or alternate steady-state
path is introduced. Restarting the affected MCP client after canonical-main
application is necessary; a Git merge alone does not reload a running process.

The outcome is compatible dependencies, deliberate connection/operation
boundaries, the inherited-Electron launch fix in fork main, and trustworthy
strategy/Pine data with recorded state effects and actual client verification.
Ordinary manual TradingView startup/use remains available throughout.

## Dependency choices and provenance

Retain the stdio architecture, the SDK1 API, chrome-remote-interface0.33.3,
and ESLint9.39.4. Pin the direct SDK to 1.31.0, the same-major security-fixed
release, rather than migrating to SDK2 or selecting every latest major.
Declare the already-used zod4.3.6 directly because tool modules import it;
this does not add a new runtime library to the existing installed graph.

Resolve the bounded dependency closure of the selected fixes, preserving
unaffected consumers' declared ranges and actual API compatibility. Prefer
existing compatible major lines; a transitive major number alone is not a
reason to reject a necessary upstream-declared dependency or add a review loop.
The concrete verified fixed floors are @hono/node-server1.19.15,
body-parser2.3.0, fast-uri3.1.8, hono4.13.7, ip-address10.7.1,
proxy-addr2.0.8, qs6.16.0, brace-expansion1.1.21 and js-yaml4.3.2.
Use these floors or a current patch in the same compatible line. Record every
actual locked version, required new edge and reason in the PR.
Prefer normal compatible resolution and a reproducible lock to permanent
overrides; do not force a package beneath an upstream consumer's required
range. A replacement library, incompatible application-facing API, changed
permissions/destinations or an unassessed consequential dependency returns to
design review before dependent work. Do not run blanket
`npm audit fix --force`. Install with scripts disabled and review the resulting
lock/integrities before using it; run `npm ci --ignore-scripts` on that lock.

One required major-line addition is already assessed: body-parser2.3.0 declares
content-type^2.0.0. Include content-type2.0.0 (or a compatible2.x patch) for that
consumer, while retaining content-type1.0.5 for SDK1.31.0 and Express5.2.1,
which declare^1.0.5. Normal npm resolution may nest the2.x package below
body-parser; do not override all consumers to either major or force1.x beneath
body-parser. Both body-parser2.3.0 and content-type2.0.0 require Node>=18,
compatible with the selected SDK/runtime minimum and observed Node26.4.0.
The official content-type2.0.0 distributable is CommonJS with parse/format
exports, no dependencies and no install lifecycle. Its documented parse API
takes a header string (not a request/response object), is lenient and returns
type/parameters; body-parser2.3.0's getCharset passes the header string and
reads parameters.charset. Consumers retaining the1.x API keep their own range.
Registry package/source inspection is compatibility evidence, not an executed
runtime result. The child checks npm's actual dependency tree for valid ranges
and both resolved majors, plus focused body-parser JSON/text/urlencoded cases
covering valid/invalid Content-Type and charset handling, and existing MCP
stdio/tool-schema tests. It does not expose an HTTP listener or run an HTTP
application merely to exercise this transitive dependency. Explain unexpected
new closure edges against the same API/engine/access/destination boundary;
neither blindly accept a resolver result nor block solely on a major number.
Sources: https://registry.npmjs.org/body-parser/2.3.0 ,
https://registry.npmjs.org/content-type/2.0.0 ,
https://registry.npmjs.org/@modelcontextprotocol/sdk/1.31.0 and
https://registry.npmjs.org/express/5.2.1 ; the content-type README/types and
body-parser lib/utils.js were read from their metadata-named official tarballs.

The registry metadata for SDK1.31.0 and CRI0.33.3 identifies respectively
github.com/modelcontextprotocol/typescript-sdk and
github.com/cyrus-and/chrome-remote-interface. Both distributables are official
registry.npmjs.org tarballs with registry integrity metadata and no package
install lifecycle. The registry's own checksum is integrity evidence, not an
independent statement of benign behavior. Dependencies still execute as the
local user when the MCP process runs. No elevated install, authentication
change, new telemetry service or new data destination is selected.

Primary advisory https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h
affects an HTTP OAuth client; it explicitly excludes SDK servers and stdio
clients. This server imports McpServer and StdioServerTransport, not an OAuth
client. Updating removes the installed affected-version match but is not
evidence of an existing credential leak. The Hono/Express/body-parser/qs/
proxy-addr reports concern HTTP middleware conditions not exercised by this
stdio entry point. fast-uri/ip-address and lint parser reports are assessed
against their actual callers; package presence alone proves no SSRF or exploit.
They receive compatible fixes to avoid retaining unnecessary known risk.

https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p
is fixed in the already-locked ws7.5.11. Preserve that fix; a malicious CDP
peer remains consequential even with a patched client. The critical proxy-addr
match is https://github.com/advisories/GHSA-jqcg-44mw-7w3h. Remaining advisory
URLs/ranges come from the dated npm audit, with current primary-source
confirmation for any disposition that affects the choice. Post-change audit
results and applicability remain separate; neither zero audit findings nor
localhost is represented as complete security or past-exposure proof.

## CDP target and operation boundaries

Replace substring URL selection with shared parsed-URL classification.
An eligible chart is a `page`, HTTPS, hostname exactly `tradingview.com` or
`www.tradingview.com`, no userinfo, default HTTPS port, and a `/chart/` path
or its layout descendant. Reject look-alike suffixes, credentials in URLs,
query-only/path-only matches and non-chart pages. Use one eligible chart
automatically only when unambiguous; allow an explicit `TV_CDP_TARGET_ID`
to select one eligible chart when multiple are open. An explicit ID never
bypasses classification. Preserve the supported host/port environment aliases;
validate port range instead of silently replacing malformed values with9222.
The intended deployment remains loopback127.0.0.1:9222; no remote endpoint is
enabled or configured in this mission.

Validate the connected target's current identity before executing subsequent
page operations so navigation cannot turn a cached client into a foreign-page
capability. On disappearance/navigation, reject affected work instead of
silently retrying a mutation on another chart. Retain explicit tab switching
with revalidation. Reuse the selector in CLI/Pine helper scripts so they do
not remain alternate substring-based entry points.

Desktop shell/landing targets are a different class needed by existing tab
operations. Keep them separate from chart selection: constrain file URLs to
the installed TradingView application's resources and expected shell/landing
paths and require the existing expected DOM capability. A page title such as
"New tab" alone is insufficient. Do not broaden chart eligibility to support
shell operations. If the actual app3.4.1 layout differs, establish that exact
app-owned path/capability through read-only target evidence before its use;
an unresolved identity holds only the tab operation. Do not click through
unrelated tabs to find a matching ordinal. Preserve tabs/layouts unless a
specific test genuinely needs a reversible operation.

Keep required tool families and CLI features; no unused-function deletion is
justified by the current evidence. `ui_evaluate` remains an explicitly powerful
escape hatch for trusted callers, with a description stating arbitrary
same-account JavaScript, credential-bearing page access and possible network/
saved-state effects. It is not a sandbox or read-only API. Its underlying
evaluation follows the same target validation. Do not invent a uniform
read-only guarantee while other UI, Pine, alerts, replay and layout tools can
mutate state. Document those effects and use the specific tool for the task.
The mission uses no arbitrary trading/account/order operation, alert creation,
watchlist edit, publishing or live replay trade as a verification shortcut.

## Launch and existing changes

Port only the effective fefc3a8 launch-environment change into the current
`_spawnDetached` helper: clone the inherited environment, remove
ELECTRON_RUN_AS_NODE for the TradingView child only, retain other variables,
and do not mutate the MCP parent environment. Cover all existing spawn paths
without copying the obsolete local-fixes branch or regressing later upstream
features. The Manager observed that variable present in this T3 Codex shell;
that observation is not actual T3 Claude-client verification.

Default launch must not broadly kill existing TradingView processes. Reuse
a verified existing debug instance; otherwise use non-killing startup and
report a running non-debug-instance conflict. Keep explicit destructive restart
as an operator-selected operation with an accurate tool description, never
perform it as an automatic test/recovery. Report `success:false` when CDP did
not become ready; a spawned PID alone is not successful launch/connection.
No process of unknown ownership is terminated to create a test baseline.

Main already contains the upstream strategy improvements and snake_case
metrics (for example `metrics.net_profit`), plus8-decimal drawing rounding.
Do not replay c56d210 or replace current code with local-fixes. Inspect each
actual affected contract and add only necessary corrections/regression coverage.

## Data, consumers and saved Pine identity

Preserve `metrics.net_profit`, `total_trades`, `percent_profitable`,
`profit_factor`, `max_drawdown` and the current structured response. Inspect
the in-repo strategy-report/pine-develop skills and CLI plus the explicitly
related Trading Skills Lab programs/materials; the bounded tracked search
found no camelCase strategy-result consumer in Trading Skills Lab. Its Python
backtests are separate consumers, not automatically MCP clients. Update this
repo's descriptions/examples to the actual snake_case contract. Do not add
legacy camelCase aliases without an actual caller that needs them. A proven
other-row correction uses contract§14 with its own ordinary gates; it is not
silently implemented here. None is currently selected.

Strategy reads currently open the tester and unhide every hidden strategy.
Remove the unrelated-strategy visibility changes. Select the intended strategy
by an exact entity ID when ambiguous; prepare only that strategy with an
explicit caller option when calculation needs a visibility change. Report
which panel/visibility effects occurred. A missing report is an explicit
not-ready result, never a fabricated zero or another strategy's report.
Keep trade/equity availability and truncation limits explicit.

For saved Pine verification, list saved scripts, settle one exact saved ID and
version, open that intended saved script, and read its source. Name-only fuzzy
first-match selection and `version || 1` are not valid identity evidence.
Expose exact saved ID/version in the result and reject ambiguity/not-found.
Compare saved-source and editor-source digests and actual editor identity;
loading text into the current editor buffer does not prove its saved identity.
If current `pine_open` only injects text into a different editor context, fix
that limited operation using the app's existing saved-script open behavior;
do not implement a DW-wide identity harness or compile/save as an opening
shortcut. An unavailable native identity/open mechanism returns to the Manager
before dependent verification, not a false success result.

Before any editor mutation, establish the existing script ID/version, buffer
digest, dirty state, cursor/selection and relevant panel state. Do not discard
an unsaved buffer. Keep needed original buffer content transiently in the
executing process, not in published logs or a second runtime/repository.
Restore the exact prior script/buffer/panel state and verify it; re-read the
saved ID/version/source to distinguish cloud saved state from editor state.
No script save, publication, account change or indicator-code edit is selected.
An uncertain restoration holds further editor mutations and is disclosed to
the existing owner. Do not claim old August restoration is repaired.

For the adopted symbol/study, check the existing8-decimal prices against
available coordinates/tick precision. For labels, compare total/returned counts,
default50 and an adequate explicit `max_labels`, study filter, IDs/coordinates
and duplicate/truncation meaning. For tables retain the existing formatted rows
and add structured table ID/cells with row/column indices and empty positions
so omitted blanks cannot shift meaning. Do not promise decoration or timeframe
identity from strings alone. Use only needed study data; do not lighten or
revalidate the whole DW indicator system. Empty/unavailable results carry their
limits and do not count as a successful required-data check.

## Proportionate verification and actual application

One initial implementation child combines these tightly coupled dependency,
connection, launch and data-contract changes. Its independent PR review checks
the implemented approved design; it does not repeat the whole design review.
The child tests offline negative target cases, multiple/explicit target choice,
cached-target navigation, script/CLI path reuse, launch inherited-variable
removal with parent preservation and no broad kill/default false-success,
strategy identity/side effects, exact saved-script selection, label limits,
table empty cells/coordinates and MCP schema/data compatibility. Use meaningful
test doubles for these boundaries, clearly labelled as offline evidence.
Run lint, the relevant existing unit suite and stdio initialize/list/call
checks; do not run the broad mutating E2E suite against the user's account.

After independent child PR OK/merge and canonical fast-forward, apply the
reviewed lock to canonical main with scripts disabled through the authorized
Implementer. Restart only the affected MCP client by its existing owner.
Record main/lock/runtime identity and actual server command. Verify intended
launch, connection, chart state, bounded price/indicator data, strategy metrics
and exact saved-Pine source identity with the stated state safeguards. Reuse
the already-existing user app/profile; no blank synthetic account or runtime
copy substitutes for it. Observe manual startup/use separately and preserve it.
The live test records target/symbol/resolution/strategy/saved ID/version,
safe field names/types/digests, actual effects and restoration; no cookies,
tokens, credentials, full proprietary Pine source or unnecessary account data
go into AI inputs, GitHub or logs. TradingView endpoints receive the normal
authenticated page requests; MCP outputs go to the authorized local client
and the selected AI provider to the extent requested. Minimize that output.

Actual T3 Claude-environment launch/connection/needed-data verification is
still required. The current native catalog reports claudeAgent unauthenticated;
Codex role assignment neither grants Claude authentication nor proves a Claude
host test. Preferred route: a user/operator uses the existing T3 Claude client
at its actual registered Trading Skills Lab project, with the unchanged MCP
main path, to execute the bounded reviewed launch/health/chart/strategy/Pine
checks and provide safe original tool outcomes. This operator is not assigned
an Implementer/Reviewer/Auditor role. Manager requests the necessary concrete
operator action through GM once the reviewed test is ready. The user owns any
authentication, access or cost decision; no agent changes those settings.
An ordinary CLI or synthetic ELECTRON variable test is additional evidence
only. If an actual client test cannot lawfully run, hold that criterion and
parent check/completion; continue independent authorized code/review work.
Do not silently waive it or change provider assignment. A scope change is
the user's decision and requires the existing design/source handling.

Application restoration uses reviewed fork-main history and the previous lock
through the existing independent correction/revert route, followed by the
affected client's restart. Do not reset canonical main, rewrite history,
delete dependencies/branches/worktrees or undo unrelated user changes.
Runtime restart or file rollback does not undo already-saved cloud state;
the test avoids cloud writes and discloses any uncertain effect without repeat.

## Roles, order and completion

All roles are independent Codex ordinary T3 chats. Choose gpt-6.1-sol/high,
serviceTier default, with explicit full-access/default launch options for
Mission Reviewer, child Implementer/Reviewer, Parent Implementer and Mission
Auditor: target safety, consequential compatibility and evidence justify the
strong row. Never change model/provider/effort/billing for quota.

Design request/independent OK precedes child filing and direct worktree launch.
Children and any necessary supporting unit remain serial. The initial child
implements the approved changes, independently reviews/merges, performs
applicable After-merge verification and closes through its own Reviewer.
No child is predesignated as last and none exists only for integration.
The Parent Implementer then reuses this design worktree for integration,
records actual applied constraints and remaining operator evidence, obtains
independent parent PR OK before merge, requests execution check, then current
independent mission audit. The same Mission Reviewer alone conditionally
completes under contract§10 after all requirements and source gates hold.

No predecessor roles/tests/application are recalled or rerun merely for receipt.
Registration431, parallel443 and maintenance447 reports are references with
their historical limits, not uniform host-enforcement claims. Plan3's residual
findings/acquisition/retention unknowns remain outside this work. Preserve all
histories, repos, branches and worktrees; GM alone owns eligible role archive.
Plan4 completion/current audit/plan reflection precedes plan5, then6 singly.
Shared effects are canonical fork-main, the existing TradingView app/profile,
CDP9222 and those two existing MCP consumers; their live operations are serial
and existing owners retain restart/access authority. No stock environment,
Sheets/pipeline, external core, signing/distribution or complex workaround is
selected. No Computer Use or external developer inquiry/contact is authorized.

Correct proven no-effect defects at their phase owner. Hold an unknown effect
and its dependants without repeating it; stop concrete danger only as far as
it reaches while independent authorized work continues. Necessary changes to
this design return to the parent review and E/L before dependent execution.
User-owned purpose/scope/required-safety/access/cost decisions go through the
established GM with organized Japanese options and recommendation.
