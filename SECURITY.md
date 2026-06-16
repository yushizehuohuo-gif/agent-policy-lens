# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Agent Policy Lens, please report it by opening a [GitHub issue](https://github.com/yushizehuohuo-gif/agent-policy-lens/issues) or emailing the maintainer directly.

Do **not** open a public issue for vulnerabilities that could expose real credentials or bypasses before they are fixed.

## Scope

Agent Policy Lens is a static analysis CLI tool. It:

- Never sends data off your machine
- Never reads beyond the directory you point it at (+ global config paths when `--include-home` is set)
- Redacts secret values from all output formats (table, markdown, JSON)
- Runs with zero runtime dependencies

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## What to Expect

- **Acknowledgment** within 72 hours
- **Fix or mitigation** within a reasonable timeframe depending on severity
- **Credit** in the release notes (unless you prefer to remain anonymous)
