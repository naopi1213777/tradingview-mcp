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

## Runtime and disclosure boundary

The stdio bridge uses the existing local CDP endpoint; the authenticated page
still has network and account access. Tool outputs reach the selected client
and may be sent to its AI provider. `ui_evaluate` is arbitrary same-account
JavaScript and can read credential-bearing state, send network requests and
change saved state. Other mutating tools are also powerful. URL validation
reduces wrong-target risk; it does not isolate JavaScript or enforce a uniform
read-only mode. Keep CDP on loopback and use trusted callers with minimal output.

Do not print credentials or full proprietary Pine source to providers or logs.
A clean editor is required for exact saved-script opening; inspect partial or
unknown effects before another mutation. A restart or Git revert cannot undo
cloud saves or account effects. See [architecture](docs/architecture.md) for
implemented controls and measured limits, and [dependency verification](docs/dependency-verification.md)
for the dated package/advisory assessment. Zero audit findings is not a safety
or historical-exposure guarantee.
