# v0.1.1 Release Notes

Agent Policy Lens is a zero-dependency CLI that shows what your AI agents can run, read, and leak.

## Highlights

- Published the package to npm as `agent-policy-lens`
- Added README badges, install instructions, and a clearer demo flow
- Added package metadata for npm and GitHub discovery
- Kept the scanner dependency-free and CI-friendly

## Try it

```bash
npx agent-policy-lens .
```

Or scan the intentionally unsafe fixture:

```bash
npx agent-policy-lens examples/unsafe-repo
```

## What it detects

- MCP servers that receive secret-like environment variables
- Remote installer pipes such as `curl ... | bash`
- Unpinned runtime package runners such as `npx` and `uvx`
- Broad filesystem paths such as `/`, `C:\`, `$HOME`, and `%USERPROFILE%`
- Plaintext remote agent endpoints
- Auto-approval or safety-bypass instructions

## Links

- Repository: https://github.com/yushizehuohuo-gif/agent-policy-lens
- npm: https://www.npmjs.com/package/agent-policy-lens
