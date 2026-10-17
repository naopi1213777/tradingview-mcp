# Setup Guide for Claude Code

This file is a step-by-step guide for Claude Code (or any LLM agent) to install and configure the TradingView MCP server. If a user asks you to install or set up this project, use the reviewed fork and the operation boundaries below. Existing registrations are reused; a setup example does not authorize configuration, authentication or saved-state changes.

## Step 1: Clone and Install

```bash
git clone https://github.com/naopi1213777/tradingview-mcp.git ~/tradingview-mcp
cd ~/tradingview-mcp
npm ci --ignore-scripts
```

If the user specifies a different install path, use that instead of `~/tradingview-mcp`.

## Step 2: Add to MCP Config

Add the server to the user's Claude Code MCP configuration. The config file is at `~/.claude/.mcp.json` (global) or `.mcp.json` (project-level).

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "node",
      "args": ["<INSTALL_PATH>/src/server.js"]
    }
  }
}
```

Replace `<INSTALL_PATH>` with the actual path where the repo was cloned (e.g., `/Users/username/tradingview-mcp`).

If the config file already exists and has other servers, merge the `tradingview` entry into the existing `mcpServers` object. Do not overwrite other servers.

## Step 3: Launch TradingView Desktop

TradingView Desktop must be running with Chrome DevTools Protocol enabled.

**Guarded launch:** use `tv_launch` with `{"port":9222,"kill_existing":false}`,
or `node src/cli/index.js launch`. It removes inherited `ELECTRON_RUN_AS_NODE`
only for the app child, preserves the MCP parent environment, and reuses a
verified existing debug endpoint. A running non-debug instance is a conflict;
its owner must check unsaved state and close it normally before another attempt.
Never terminate an unknown process or select a save/discard confirmation to
make a check pass. A PID alone is not readiness: inspect `success` and `cdp_ready`.

The legacy `scripts/launch_tv_debug*` wrappers terminate app processes and lack
these guards; do not use them as the routine startup or verification shortcut.
Manual startup using the installed app's `--remote-debugging-port=9222` flag
remains available. Preserve the existing profile and chart.

On Windows Store installations, local-copy fallback requires the explicit
`kill_existing:true` destructive-restart option; it is not attempted by default.
That option may terminate existing instances and create a separate app copy.
It is outside the macOS deployment verified here. Do not change WindowsApps ACLs.

## Step 4: Restart Claude Code

The MCP server only loads when Claude Code starts. After adding the config:

1. Have the owner restart only the affected MCP client through its normal interface.
2. Confirm it rereads the existing canonical `src/server.js` command and current main.
3. Verify the connection from that actual client. A merge or separate SDK test does not reload an already-running registered server.

## Step 5: Verify Connection

Use the `tv_health_check` tool. Expected response:

```json
{
  "success": true,
  "cdp_connected": true,
  "chart_symbol": "...",
  "api_available": true
}
```

On failure, inspect the returned error and current endpoint/target before another operation. An unavailable, foreign or ambiguous target is not proof that the app is absent. Select only an exact eligible chart ID; see [architecture](docs/architecture.md).

## Step 6: Install CLI (Optional)

To use the `tv` CLI command globally:

```bash
cd ~/tradingview-mcp
npm link
```

Then `tv status`, `tv quote`, `tv pine compile`, etc. work from anywhere.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `cdp_connected: false` | Launch TradingView with `--remote-debugging-port=9222` |
| Windows: "Access is denied" launching from `WindowsApps` | Default launch returns failure; local-copy fallback requires a deliberate destructive restart decision. Never change WindowsApps ACLs |
| `ECONNREFUSED` | TradingView isn't running or port 9222 is blocked |
| MCP server not showing in Claude Code | Check `~/.claude/.mcp.json` syntax, restart Claude Code |
| `tv` command not found | Run `npm link` from the project directory |
| Tools return stale data | TradingView may still be loading — wait a few seconds |
| Saved-Pine open fails | Inspect identity/dirty/draft/dialog state first; display one clean saved editor deliberately. Do not inject, compile, save or discard to repair a failure |

## What to Read Next

- `CLAUDE.md` — Decision tree for which tool to use when (auto-loaded by Claude Code)
- `README.md` — Tool reference and operation effects
- `RESEARCH.md` — Research context and open questions
