# GitHub mission registration

This repository is registered for the GitHub mission operation of the global rules, by mission [naopi1213777/ai-agent-rules#421](https://github.com/naopi1213777/ai-agent-rules/issues/421). This is setup documentation, not another rules owner: execution rules stay in the global ruleset and in this repository's `AGENTS.md`.

| Item | Value |
|---|---|
| Repository | `naopi1213777/tradingview-mcp`, default branch `main` |
| Canonical execution root | `/Users/mn/codex/mcp-tools/tradingview-mcp` |
| Target project name | `TradingView MCP`, the row in `broker/policy.py` `TARGETS` of `naopi1213777/ai-agent-rules` |
| Merge check | `observed`: every check run and status that exists for the reviewed head must be a completed success; a head with none passes. No check is created by this registration. |
| Global procedure | `/Users/mn/codex/ai-agent-rules/REVIEW_WORKFLOW.md` (GitHub mission) and `/Users/mn/codex/ai-agent-rules/workflow/github-mission/contract.md` |
| Related records | `/Users/mn/Agent-Vault/20_Projects/Trading Skills Lab/specs/` These records are shared with Trading Skills Lab; that does not make it the same repository or execution root. |
| Project protection | tracked `.claude/settings.json`; `.broker/` and `.worktrees/` are ignored |

## Reading records across projects

GitHub writes and reads for this repository go through this row's own broker queue, selected by running the existing broker client from the canonical root. The queue a request is drained from fixes its repository, so an `issue-read` or `issue-comment-read` from this root reaches only this repository; another row's Issue comments, including the rules-home mission Issues, cannot be fetched through it. The broker journal and results stay one shared store, readable as the evidence a role cites, including the result locators in its daily log; the per-operation token area (`git-tmp`) stays unreadable. That shared visibility is the residual accepted in the [naopi1213777/ai-agent-rules#274 audit](https://github.com/naopi1213777/ai-agent-rules/issues/274#issuecomment-5950464285), not a cross-project Issue-reading permission.
