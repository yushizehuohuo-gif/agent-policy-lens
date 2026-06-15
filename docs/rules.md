# Rules

Agent Policy Lens reports permission surfaces, not moral judgments. A high finding means "review this before it becomes normal."

| Code | Severity | Why it matters |
| --- | --- | --- |
| `REMOTE_INSTALLER_PIPE` | Critical | Downloaded code is executed directly by a shell. |
| `DANGEROUS_PERMISSION_FLAG` | Critical | A command weakens sandboxing or grants broad runtime privileges. |
| `LIVE_SECRET_IN_AGENT_CONFIG` | Critical | A config appears to contain an actual credential value. |
| `LIVE_SECRET_IN_ENV_FILE` | Critical | An environment file appears to contain an actual credential value. |
| `SHELL_COMMAND_AGENT` | High | Shell entrypoints are hard to review and can hide extra behavior. |
| `UNPINNED_PACKAGE_RUNNER` | High | The agent resolves executable code at runtime without a pinned version. |
| `BROAD_FILESYSTEM_ACCESS` | High | The agent can read a root, home, or system-level path. |
| `SECRET_ENV_GRANTED` | High | A secret-like environment variable is passed to an agent process. |
| `PLAINTEXT_REMOTE_AGENT` | High | Agent context can travel over plaintext HTTP. |
| `AUTO_APPROVE_ENABLED` | High | Approval prompts appear disabled or automatic. |
| `INSTRUCTION_AUTO_APPROVE` | High | Agent instructions normalize automatic approval. |
| `INSTRUCTION_IGNORES_SAFETY` | High | Agent instructions appear to weaken guardrails. |
| `INSTRUCTION_EXFILTRATES_SECRETS` | Critical | Agent instructions ask for secrets to be exposed. |
| `INSTRUCTION_DESTRUCTIVE_COMMAND` | Critical | Agent instructions include broad destructive commands. |
| `REMOTE_AGENT_ENDPOINT` | Medium | Agent context is sent to a remote endpoint. |
| `PACKAGE_RUNNER_AGENT` | Medium | A runtime package runner is used, even if pinned. |
| `UNREADABLE_AGENT_CONFIG` | Medium | The config could not be parsed for review. |
| `UNKNOWN_AGENT_CONFIG_SHAPE` | Low | The file looks like an agent config but the scanner cannot extract servers yet. |
| `EXAMPLE_ENV_LOOKS_REAL` | Low | An example environment value looks too specific. |

## Redaction

Reports never print discovered secret values. JSON output redacts environment values and table/markdown output only shows environment keys.

## False positives

Some teams intentionally use remote MCP servers or broad filesystem tools. Keep those findings, but write down the reason in the pull request or future baseline file.
