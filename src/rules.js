export const severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const secretValuePatterns = [
  { code: "OPENAI_KEY", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/i },
  { code: "ANTHROPIC_KEY", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/i },
  { code: "GITHUB_TOKEN", pattern: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})\b/i },
  { code: "AWS_ACCESS_KEY", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { code: "GOOGLE_API_KEY", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { code: "SLACK_TOKEN", pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/i },
  { code: "PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i }
];

const secretKeyPattern = /(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|passwd|private[_-]?key|github[_-]?token|openai[_-]?api[_-]?key|anthropic[_-]?api[_-]?key|aws[_-]?(?:access|secret)|cookie|session)/i;

const shellCommands = new Set(["bash", "sh", "zsh", "fish", "powershell", "pwsh", "cmd"]);
const packageRunners = new Set(["npx", "uvx", "pipx", "bunx", "pnpm", "yarn", "docker"]);

export function analyzeServerSurface(surface, source) {
  const findings = [];
  const commandLine = commandLineFor(surface);

  for (const finding of analyzeCommandLine(commandLine, surface, source)) {
    findings.push(finding);
  }

  if (surface.url) {
    const severity = /^http:\/\//i.test(surface.url) ? "high" : "medium";
    findings.push(makeFinding({
      severity,
      code: /^http:\/\//i.test(surface.url) ? "PLAINTEXT_REMOTE_AGENT" : "REMOTE_AGENT_ENDPOINT",
      title: /^http:\/\//i.test(surface.url)
        ? "Agent endpoint uses plaintext HTTP"
        : "Agent endpoint sends context to a remote service",
      message: `${surface.name} connects to ${redactUrl(surface.url)}.`,
      recommendation: /^http:\/\//i.test(surface.url)
        ? "Use HTTPS or a local transport for agent traffic."
        : "Document what data is sent to this endpoint and keep tokens scoped.",
      surface,
      source,
      needle: surface.url
    }));
  }

  for (const [key, value] of Object.entries(surface.env ?? {})) {
    const valueText = String(value ?? "");
    const hasSecretName = isSecretishKey(key) || isSecretishKey(valueText);
    const detectedSecret = detectSecretValue(valueText);

    if (detectedSecret) {
      findings.push(makeFinding({
        severity: "critical",
        code: "LIVE_SECRET_IN_AGENT_CONFIG",
        title: "Possible live secret in agent config",
        message: `${surface.name} contains a ${detectedSecret.code} value in ${key}.`,
        recommendation: "Move the value into a secret manager or environment variable reference, then rotate it.",
        evidence: `${key}=<redacted>`,
        surface,
        source,
        needle: valueText
      }));
    } else if (hasSecretName) {
      findings.push(makeFinding({
        severity: "high",
        code: "SECRET_ENV_GRANTED",
        title: "Secret-like environment variable is granted to an agent",
        message: `${surface.name} receives ${key}.`,
        recommendation: "Prefer a narrow, purpose-built token and document why this agent needs it.",
        evidence: `${key}=<redacted-or-reference>`,
        surface,
        source,
        needle: key
      }));
    }
  }

  if (surface.rawText && looksAutoApproved(surface.rawText)) {
    findings.push(makeFinding({
      severity: "high",
      code: "AUTO_APPROVE_ENABLED",
      title: "Agent approvals appear to be automatic",
      message: `${surface.name} includes an auto-approval setting.`,
      recommendation: "Keep approval prompts on for write, shell, browser, and network-capable tools.",
      surface,
      source,
      needle: "auto"
    }));
  }

  return findings;
}

export function analyzeCommandLine(commandLine, surface, source = "") {
  const findings = [];
  if (!commandLine.trim()) {
    return findings;
  }

  const lower = commandLine.toLowerCase();
  const commandBase = executableBase(surface.command ?? commandLine.split(/\s+/)[0]);

  const remoteInstallerPipe = commandLine.match(/(?:curl|wget|irm|iwr)\b[\s\S]{0,160}\|\s*(?:bash|sh|zsh|powershell|pwsh)\b/i);
  if (remoteInstallerPipe) {
    findings.push(makeFinding({
      severity: "critical",
      code: "REMOTE_INSTALLER_PIPE",
      title: "Remote script is piped into a shell",
      message: `${surface.name} can execute downloaded code directly.`,
      recommendation: "Pin and verify downloaded artifacts before execution, or replace this with a local package.",
      surface,
      source,
      needle: remoteInstallerPipe[0]
    }));
  }

  if (shellCommands.has(commandBase) && /\s(?:-c|\/c|-command|command)\b/i.test(commandLine)) {
    findings.push(makeFinding({
      severity: "high",
      code: "SHELL_COMMAND_AGENT",
      title: "Agent starts through an unrestricted shell",
      message: `${surface.name} launches via ${commandBase}.`,
      recommendation: "Prefer a direct executable with fixed arguments so review tools can reason about it.",
      surface,
      source,
      needle: surface.command ?? commandLine
    }));
  }

  if (packageRunners.has(commandBase)) {
    const unpinned = commandBase !== "docker" && !hasPinnedPackageReference(commandLine);
    findings.push(makeFinding({
      severity: unpinned ? "high" : "medium",
      code: unpinned ? "UNPINNED_PACKAGE_RUNNER" : "PACKAGE_RUNNER_AGENT",
      title: unpinned ? "Agent uses an unpinned package runner" : "Agent resolves code at runtime",
      message: `${surface.name} starts through ${commandBase}.`,
      recommendation: unpinned
        ? "Pin the package version or vendor the server so agent behavior is reproducible."
        : "Keep the image or package pinned and reviewed.",
      surface,
      source,
      needle: surface.command ?? commandBase
    }));
  }

  if (/\b(?:--dangerously-skip-permissions|--allow-all|--no-sandbox|--privileged|--cap-add|--security-opt)\b/i.test(commandLine)) {
    findings.push(makeFinding({
      severity: "critical",
      code: "DANGEROUS_PERMISSION_FLAG",
      title: "Dangerous permission flag is enabled",
      message: `${surface.name} includes a flag that disables or weakens isolation.`,
      recommendation: "Remove the flag and grant only the specific permission needed for the workflow.",
      surface,
      source,
      needle: commandLine
    }));
  }

  const broadPath = findBroadFilesystemArgument(surface.args ?? []);
  if (broadPath) {
    findings.push(makeFinding({
      severity: "high",
      code: "BROAD_FILESYSTEM_ACCESS",
      title: "Agent can read a broad filesystem path",
      message: `${surface.name} is configured with ${broadPath}.`,
      recommendation: "Scope filesystem servers to the smallest project directory possible.",
      evidence: broadPath,
      surface,
      source,
      needle: JSON.stringify(broadPath)
    }));
  }

  return findings;
}

export function analyzeEnvFile(file, source, root) {
  const findings = [];
  const isExample = /\.example$|\.sample$|\.template$|example/i.test(file);
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim().replace(/^export\s+/, "");
    const value = rawValueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
    const detectedSecret = detectSecretValue(value);
    const secretish = isSecretishKey(key);
    const placeholder = /^(?:changeme|replace_me|your_|example|xxx+|<.*>|\${.*}|)$/i.test(value);

    if (detectedSecret) {
      findings.push({
        severity: "critical",
        code: "LIVE_SECRET_IN_ENV_FILE",
        title: "Possible live secret in environment file",
        message: `${displayPath(file, root)} contains a ${detectedSecret.code} value for ${key}.`,
        recommendation: "Remove it from the repository, rotate it, and keep only an example placeholder.",
        file,
        line: index + 1,
        evidence: `${key}=<redacted>`
      });
    } else if (!isExample && secretish && !placeholder) {
      findings.push({
        severity: "high",
        code: "COMMITTED_SECRETISH_ENV",
        title: "Secret-like value appears committed",
        message: `${displayPath(file, root)} contains ${key}.`,
        recommendation: "Move this value out of the repo and add a safe .env.example entry.",
        file,
        line: index + 1,
        evidence: `${key}=<redacted>`
      });
    } else if (isExample && secretish && !placeholder) {
      findings.push({
        severity: "low",
        code: "EXAMPLE_ENV_LOOKS_REAL",
        title: "Example environment value looks specific",
        message: `${displayPath(file, root)} has a non-placeholder value for ${key}.`,
        recommendation: "Use obvious placeholders in example files.",
        file,
        line: index + 1,
        evidence: `${key}=<redacted>`
      });
    }
  });

  return findings;
}

export function analyzeInstructionFile(surface, source) {
  const checks = [
    {
      pattern: /\b(?:always|auto)[-\s]?(?:approve|allow)\b|\bnever ask\b|\bdo not ask\b/i,
      severity: "high",
      code: "INSTRUCTION_AUTO_APPROVE",
      title: "Instruction asks for automatic approval",
      recommendation: "Keep human approval for write, shell, browser, and network-capable actions."
    },
    {
      pattern: /\bignore\b.{0,40}\b(?:safety|policy|guardrail|previous instructions)\b/i,
      severity: "high",
      code: "INSTRUCTION_IGNORES_SAFETY",
      title: "Instruction appears to weaken safety rules",
      recommendation: "Remove broad safety bypass language and state the intended workflow instead."
    },
    {
      pattern: /\b(?:read|print|dump|exfiltrate|send)\b.{0,50}\b(?:secret|token|password|\.env|credential)\b/i,
      severity: "critical",
      code: "INSTRUCTION_EXFILTRATES_SECRETS",
      title: "Instruction asks the agent to expose secrets",
      recommendation: "Delete the instruction and rotate any credentials that may have been exposed."
    },
    {
      pattern: /\brm\s+-rf\s+\/|Remove-Item\b[\s\S]{0,80}\b-Recurse\b[\s\S]{0,80}\b-Force\b/i,
      severity: "critical",
      code: "INSTRUCTION_DESTRUCTIVE_COMMAND",
      title: "Instruction contains a destructive command",
      recommendation: "Replace destructive examples with scoped cleanup commands."
    }
  ];

  const findings = [];
  for (const check of checks) {
    const match = source.match(check.pattern);
    if (match) {
      findings.push(makeFinding({
        severity: check.severity,
        code: check.code,
        title: check.title,
        message: `${surface.name} contains risky agent guidance.`,
        recommendation: check.recommendation,
        surface,
        source,
        needle: match[0]
      }));
    }
  }

  return findings;
}

export function summarizeFindings(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let highest = "info";
  let score = 0;

  for (const finding of findings) {
    const severity = finding.severity ?? "info";
    counts[severity] = (counts[severity] ?? 0) + 1;
    if (severityRank[severity] > severityRank[highest]) {
      highest = severity;
    }
    score += severity === "critical" ? 30 : severity === "high" ? 10 : severity === "medium" ? 3 : severity === "low" ? 1 : 0;
  }

  return {
    total: findings.length,
    highest: findings.length ? highest : "none",
    score,
    counts
  };
}

export function isSecretishKey(value) {
  return secretKeyPattern.test(String(value ?? ""));
}

export function detectSecretValue(value) {
  const text = String(value ?? "");
  return secretValuePatterns.find((entry) => entry.pattern.test(text)) ?? null;
}

export function commandLineFor(surface) {
  return [surface.command, ...(surface.args ?? [])]
    .filter((part) => part !== undefined && part !== null && String(part).trim())
    .map((part) => String(part))
    .join(" ");
}

export function executableBase(command) {
  const raw = String(command ?? "").trim().split(/\s+/)[0] ?? "";
  return raw
    .replace(/^["']|["']$/g, "")
    .split(/[\\/]/)
    .pop()
    .replace(/\.(?:exe|cmd|bat|ps1)$/i, "")
    .toLowerCase();
}

function makeFinding({ severity, code, title, message, recommendation, evidence, surface, source, needle }) {
  return {
    severity,
    code,
    title,
    message,
    recommendation,
    file: surface.file,
    line: lineFor(source, needle),
    surfaceId: surface.id,
    evidence: evidence ?? safeEvidence(needle)
  };
}

function lineFor(source, needle) {
  if (!source || !needle) {
    return undefined;
  }
  const index = source.indexOf(String(needle));
  if (index < 0) {
    return undefined;
  }
  return source.slice(0, index).split(/\r?\n/).length;
}

function safeEvidence(value) {
  if (!value) {
    return undefined;
  }
  const text = String(value).replace(/\s+/g, " ").trim();
  if (detectSecretValue(text)) {
    return "<redacted>";
  }
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function hasPinnedPackageReference(commandLine) {
  const tokens = commandLine.split(/\s+/).filter(Boolean);
  return tokens.some((token) => {
    const clean = token.replace(/^["']|["']$/g, "");
    if (clean.startsWith("@")) {
      const lastAt = clean.lastIndexOf("@");
      return lastAt > 0 && /\d/.test(clean.slice(lastAt + 1));
    }
    return /^[a-z0-9_.-]+@[0-9]/i.test(clean);
  });
}

function findBroadFilesystemArgument(args) {
  for (const arg of args.map(String)) {
    const clean = arg.replace(/^["']|["']$/g, "");
    if (
      clean === "/" ||
      clean === "\\" ||
      clean === "~" ||
      /^[A-Za-z]:\\?$/.test(clean) ||
      /^\$HOME(?:\/|\\)?$/i.test(clean) ||
      /^%USERPROFILE%(?:\/|\\)?$/i.test(clean) ||
      /^\/(?:Users|home|etc|var|opt|private)$/.test(clean)
    ) {
      return clean;
    }
  }
  return null;
}

function looksAutoApproved(source) {
  return /"?(?:autoApprove|auto_approve|alwaysAllow|always_allow)"?\s*:\s*(?:true|"all"|\[[\s\S]{0,240}\])/i.test(source);
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.username = parsed.username ? "<redacted>" : "";
    parsed.password = parsed.password ? "<redacted>" : "";
    parsed.search = parsed.search ? "?<redacted>" : "";
    return parsed.toString();
  } catch {
    return String(url).replace(/\/\/[^@\s]+@/, "//<redacted>@");
  }
}

function displayPath(file, root) {
  if (!root) {
    return file;
  }
  return file.startsWith(root) ? file.slice(root.length + 1) || "." : file;
}
