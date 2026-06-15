# Security Policy

Agent Policy Lens handles sensitive configuration, so reports should never include raw secret values.

Please open a private security advisory or contact the maintainer before publishing details if you find:

- a case where secret values are printed in output
- a parser bug that causes risky config to be silently skipped
- a command injection issue in the CLI

For normal false positives or missing config formats, open a public issue.
