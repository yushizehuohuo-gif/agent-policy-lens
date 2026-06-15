# Agent Policy Lens

Inventory AI agent and MCP permissions before they surprise you.

`agent-policy-lens` is a zero-dependency CLI that scans a repo for AI agent surfaces: MCP servers, agent instruction files, package scripts, and environment files. It turns scattered config into a short risk report you can read in a pull request.

```bash
npx agent-policy-lens .
```

## Why this exists

AI coding tools are becoming part of the development environment, but their permissions are easy to miss in review:

- one MCP server can receive a repo path and a token
- one package script can pipe a remote installer into a shell
- one agent instruction file can normalize auto-approval
- one `.env` file can accidentally turn a demo into a credential leak

This tool gives teams a small, diffable "agent permission inventory" before those configs become invisible background noise.

## What it finds

Agent Policy Lens currently inspects:

- `.mcp.json`, `mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`
- `claude_desktop_config.json`
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`
- `.github/copilot-instructions.md` and `.github/instructions/*.instructions.md`
- `.env*` files
- agent-related `package.json` scripts

It flags patterns such as:

- remote scripts piped into a shell
- unpinned runtime package runners such as `npx` and `uvx`
- broad filesystem access like `/`, `C:\`, `$HOME`, or `%USERPROFILE%`
- secret-like environment variables granted to an agent
- possible live secrets in committed config
- plaintext remote agent endpoints
- auto-approval or safety-bypass instructions

## Quick demo

```bash
node src/cli.js examples/unsafe-repo
```

Example output:

```text
Agent Policy Lens
Root: examples/unsafe-repo
Scanned files: 4
Surfaces: 5
Findings: 10 (critical=2, high=8)
Highest risk: CRITICAL
```

## Usage

```bash
agent-policy-lens [scan] [path] [options]
```

Options:

```text
--format <table|json|markdown>  Output format. Default: table
--out <file>                    Write output to a file
--fail-on <severity|none>       Exit 2 when highest risk is at least this level
--include-home                  Also inspect known global agent config paths
--max-depth <number>            Directory walk depth. Default: 6
-h, --help                      Show help
```

Common commands:

```bash
agent-policy-lens .
agent-policy-lens . --format markdown --out agent-policy-report.md
agent-policy-lens . --fail-on high
agent-policy-lens . --include-home --format json
```

## Pull request check

After publishing the package, add this to a workflow:

```yaml
name: Agent Policy Lens

on:
  pull_request:
  push:
    branches: [main]

jobs:
  scan-agent-policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx agent-policy-lens . --format markdown --out agent-policy-report.md --fail-on high
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: agent-policy-report
          path: agent-policy-report.md
```

## Output formats

Use table output for humans:

```bash
agent-policy-lens .
```

Use markdown for PR artifacts:

```bash
agent-policy-lens . --format markdown --out agent-policy-report.md
```

Use JSON for bots:

```bash
agent-policy-lens . --format json
```

## Rule philosophy

Agent Policy Lens is intentionally opinionated and explainable. It does not claim that every finding is a vulnerability. It points at permission surfaces that deserve a human sentence in review:

- What does this agent receive?
- What can it execute?
- What path can it read or write?
- What network endpoint sees context?
- Is this behavior pinned and reproducible?

See [docs/rules.md](docs/rules.md) for the first rule set.

## Roadmap

- SARIF output for GitHub code scanning
- repo baseline support for existing accepted risks
- more global config formats for Codex, Claude, Cursor, Windsurf, and VS Code
- first-class MCP server allowlists
- PR comment mode

## Development

```bash
npm test
node src/cli.js examples/unsafe-repo
node src/cli.js examples/safe-repo
```

This project has no runtime dependencies.
