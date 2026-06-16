# Agent Policy Lens 🔍

> **A zero-dependency CLI that inventories AI agent and MCP permissions before they surprise you.**

`agent-policy-lens` scans a repo for AI agent surfaces — MCP servers, agent instruction files, package scripts, and `.env` files — and turns scattered config into a short risk report you can read in a pull request.

```bash
npx agent-policy-lens .
```

---

## Why this exists

AI coding tools are becoming part of the development environment, but their permissions are easy to miss in review:

- one MCP server can receive a repo path **and** a token
- one package script can pipe a remote installer into a shell
- one agent instruction file can normalize auto-approval
- one `.env` file can accidentally turn a demo into a credential leak

This tool gives teams a small, diffable "agent permission inventory" before those configs become invisible background noise.

---

## Demo

```bash
npx agent-policy-lens examples/unsafe-repo
```

```
Agent Policy Lens
Root: examples/unsafe-repo
Scanned files: 4
Surfaces: 5
Findings: 10 (critical=2, high=8)
Highest risk: CRITICAL

Findings
1. [CRITICAL] REMOTE_INSTALLER_PIPE .mcp.json:13
   Remote script is piped into a shell
   Fix: Pin and verify downloaded artifacts before execution.
2. [CRITICAL] REMOTE_INSTALLER_PIPE package.json:3
   Remote script is piped into a shell
3. [HIGH] PLAINTEXT_REMOTE_AGENT .cursor/mcp.json:4
   Agent endpoint uses plaintext HTTP
4. [HIGH] SECRET_ENV_GRANTED .cursor/mcp.json:6
   Secret-like environment variable is granted to an agent
5. [HIGH] UNPINNED_PACKAGE_RUNNER .mcp.json:5
   Agent uses an unpinned package runner
6. [HIGH] BROAD_FILESYSTEM_ACCESS .mcp.json:6
   Agent can read a broad filesystem path
7. [HIGH] SECRET_ENV_GRANTED .mcp.json:8
   Secret-like environment variable is granted to an agent
8. [HIGH] SHELL_COMMAND_AGENT .mcp.json:12
   Agent starts through an unrestricted shell
9. [HIGH] AUTO_APPROVE_ENABLED .mcp.json:14
   Agent approvals appear to be automatic
10. [HIGH] INSTRUCTION_AUTO_APPROVE CLAUDE.md:3
   Instruction asks for automatic approval
```

In one scan, it caught: remote scripts piped into shells, plaintext HTTP agent endpoints, secrets granted to agents, unpinned runners, broad filesystem access, and auto-approval — across MCP configs, instruction files, and package scripts.

---

## What it finds

Agent Policy Lens inspects:

| Category | Files |
|----------|-------|
| MCP configs | `.mcp.json`, `mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `claude_desktop_config.json` |
| Agent instructions | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules` |
| Copilot instructions | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` |
| Environment files | `.env*` |
| Package scripts | agent-related `package.json` scripts |

It flags patterns such as:

- remote scripts piped into a shell
- unpinned runtime package runners (`npx`, `uvx`, etc.)
- broad filesystem access (`/`, `C:\`, `$HOME`, `%USERPROFILE%`)
- secret-like environment variables granted to an agent
- possible live secrets in committed config
- plaintext remote agent endpoints
- auto-approval or safety-bypass instructions

---

## Usage

```bash
agent-policy-lens [scan] [path] [options]
```

Options:

```text
--format <table|json|markdown>  Output format. Default: table
--out <file>                    Write output to a file
--fail-on <severity|none>       Exit 2 when highest risk reaches this level
--include-home                  Also inspect known global agent config paths
--max-depth <number>            Directory walk depth. Default: 6
-h, --help                      Show help
```

Common commands:

```bash
# Quick scan
agent-policy-lens .

# Markdown report for PRs
agent-policy-lens . --format markdown --out agent-policy-report.md

# Block PRs with high+ findings
agent-policy-lens . --fail-on high

# Include global configs, JSON output
agent-policy-lens . --include-home --format json
```

**Short alias:** `aplens` works everywhere `agent-policy-lens` does.

---

## Output formats

| Format | Best for |
|--------|----------|
| `table` (default) | Humans in the terminal |
| `markdown` | PR artifacts, GitHub comments |
| `json` | Bots, CI pipelines |

```bash
agent-policy-lens . --format markdown --out agent-policy-report.md
```

---

## Pull request check

Add this workflow to scan every PR:

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

---

## Rule philosophy

Agent Policy Lens is intentionally opinionated and explainable. It does **not** claim every finding is a vulnerability. It points at permission surfaces that deserve a human sentence in review:

- What does this agent receive?
- What can it execute?
- What paths can it read or write?
- What network endpoint sees context?
- Is this behavior pinned and reproducible?

See [docs/rules.md](docs/rules.md) for the full rule set.

---

## Roadmap

- [ ] SARIF output for GitHub code scanning
- [ ] Repo baseline support for existing accepted risks
- [ ] More global config formats (Codex, Claude, Cursor, Windsurf, VS Code)
- [ ] First-class MCP server allowlists
- [ ] PR comment mode

---

## Development

```bash
npm test
node src/cli.js examples/unsafe-repo
node src/cli.js examples/safe-repo
```

This project has **zero runtime dependencies.**
