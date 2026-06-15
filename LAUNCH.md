# Launch Checklist

## Repository positioning

Suggested description:

> A zero-dependency CLI that inventories AI agent and MCP permissions before they surprise you.

Suggested topics:

`ai-agent`, `mcp`, `security`, `cli`, `developer-tools`, `codex`, `claude`, `cursor`, `supply-chain`, `nodejs`

## First release

1. Create a GitHub repo named `agent-policy-lens`.
2. Add a screenshot or terminal GIF of `node src/cli.js examples/unsafe-repo`.
3. Publish `v0.1.0` with the README demo and rules doc.
4. Post a short launch note:

   > I kept finding MCP configs, agent instructions, package scripts, and `.env` files reviewed separately. Agent Policy Lens turns them into one permission report: what can the agent run, read, and receive?

## Next features likely to attract stars

- SARIF output for GitHub code scanning
- `--ignore` and baseline support
- PR comment mode
- richer Codex, Claude, Cursor, Windsurf, and VS Code global config parsing
- MCP server allowlists for teams
