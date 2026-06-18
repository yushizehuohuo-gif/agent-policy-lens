# Launch Posts

Use these as starting points for GitHub, X, Reddit, Hacker News, V2EX, or developer Discord/Slack communities.

## Short Post

I built Agent Policy Lens, a zero-dependency CLI for checking what AI agents and MCP servers can run, read, and leak.

It scans MCP configs, agent instruction files, package scripts, and `.env` files, then reports risky permission surfaces like:

- `curl ... | bash`
- broad filesystem access
- secret-like env vars passed to agents
- plaintext remote agent endpoints
- auto-approval instructions

Try it:

```bash
npx agent-policy-lens .
```

Repo: https://github.com/yushizehuohuo-gif/agent-policy-lens
npm: https://www.npmjs.com/package/agent-policy-lens

## Hacker News / Reddit Title Ideas

- Show HN: Agent Policy Lens - see what your AI agents can run, read, and leak
- I built a zero-dependency scanner for MCP and AI agent permissions
- A small CLI for reviewing AI agent permissions before they become invisible

## Longer Post

AI coding tools are becoming part of the default dev environment, but their permissions are scattered across config files.

One MCP server can receive a repo path and a token. One package script can pipe a remote installer into a shell. One instruction file can normalize auto-approval.

Agent Policy Lens turns those scattered settings into one permission report:

- what agent surfaces exist
- what they can execute
- what paths they can read
- what environment variables they receive
- what remote endpoints see context

It is dependency-free, works with `npx`, and supports table, Markdown, and JSON output.

```bash
npx agent-policy-lens .
```

I would love feedback on missing MCP config formats and rules worth adding.

Repo: https://github.com/yushizehuohuo-gif/agent-policy-lens
