import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parseJsonc } from "./jsonc.js";
import {
  analyzeCommandLine,
  analyzeEnvFile,
  analyzeInstructionFile,
  analyzeServerSurface,
  commandLineFor,
  summarizeFindings
} from "./rules.js";

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "__pycache__"
]);

export async function scan(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : 6;
  const files = await discoverFiles(root, { maxDepth });
  const includeHome = Boolean(options.includeHome);

  if (includeHome) {
    for (const homeFile of homeConfigCandidates()) {
      try {
        await fs.access(homeFile);
        files.push(homeFile);
      } catch {
        // Missing global agent configs are expected.
      }
    }
  }

  const surfaces = [];
  const findings = [];
  const scannedFiles = [];

  for (const file of unique(files)) {
    const kind = classifyFile(file);
    if (!kind) {
      continue;
    }

    const stat = await fs.stat(file).catch(() => null);
    if (!stat || stat.size > 1024 * 1024) {
      continue;
    }

    const source = await fs.readFile(file, "utf8").catch(() => null);
    if (source === null) {
      continue;
    }

    scannedFiles.push(file);

    if (kind === "mcp-config") {
      const result = scanMcpConfig(file, source, root);
      surfaces.push(...result.surfaces);
      findings.push(...result.findings);
    } else if (kind === "package-json") {
      const result = scanPackageJson(file, source, root);
      surfaces.push(...result.surfaces);
      findings.push(...result.findings);
    } else if (kind === "env-file") {
      findings.push(...analyzeEnvFile(file, source, root));
    } else if (kind === "instruction-file") {
      const surface = makeSurface({
        type: "agent-instructions",
        name: path.basename(file),
        file,
        root,
        rawText: source
      });
      const instructionFindings = analyzeInstructionFile(surface, source);
      if (instructionFindings.length > 0) {
        surfaces.push(surface);
        findings.push(...instructionFindings);
      }
    }
  }

  const summary = summarizeFindings(findings);
  return {
    tool: "agent-policy-lens",
    generatedAt: new Date().toISOString(),
    root,
    includeHome,
    scannedFiles: scannedFiles.map((file) => displayPath(file, root)),
    surfaces,
    findings: findings.sort(compareFindings),
    summary
  };
}

export async function discoverFiles(root, options = {}) {
  const files = [];
  const maxDepth = options.maxDepth ?? 6;

  async function walk(directory, depth) {
    if (depth > maxDepth) {
      return;
    }

    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await walk(fullPath, depth + 1);
        }
      } else if (entry.isFile() && classifyFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await walk(root, 0);
  return files;
}

export function classifyFile(file) {
  const normalized = file.split(path.sep).join("/");
  const basename = path.basename(file);

  if (
    basename === ".mcp.json" ||
    basename === "mcp.json" ||
    basename === "claude_desktop_config.json" ||
    normalized.endsWith("/.cursor/mcp.json") ||
    normalized.endsWith("/.vscode/mcp.json")
  ) {
    return "mcp-config";
  }

  if (basename === "package.json") {
    return "package-json";
  }

  if (/^\.env(?:\.|$)/.test(basename)) {
    return "env-file";
  }

  if (
    basename === "AGENTS.md" ||
    basename === "CLAUDE.md" ||
    basename === "GEMINI.md" ||
    basename === ".cursorrules" ||
    basename === ".windsurfrules" ||
    normalized.endsWith("/.github/copilot-instructions.md") ||
    /\/\.github\/instructions\/.*\.instructions\.md$/i.test(normalized)
  ) {
    return "instruction-file";
  }

  return null;
}

function scanMcpConfig(file, source, root) {
  const surfaces = [];
  const findings = [];
  let config;

  try {
    config = parseJsonc(source, displayPath(file, root));
  } catch (error) {
    findings.push({
      severity: "medium",
      code: "UNREADABLE_AGENT_CONFIG",
      title: "Agent config could not be parsed",
      message: `${displayPath(file, root)} is not valid JSON/JSONC.`,
      recommendation: "Fix the config syntax so reviewers and scanners can inspect it.",
      file,
      line: undefined,
      evidence: error.message
    });
    return { surfaces, findings };
  }

  for (const { label, servers } of serverContainers(config)) {
    for (const [name, server] of Object.entries(servers)) {
      if (!server || typeof server !== "object") {
        continue;
      }

      const surface = makeSurface({
        type: "mcp-server",
        name: `${label}:${name}`,
        file,
        root,
        command: firstString(server.command, server.cmd, server.executable),
        args: normalizeArgs(server.args),
        url: firstString(server.url, server.endpoint, server.serverUrl),
        env: normalizeEnv(server.env ?? server.environment),
        rawText: JSON.stringify(server)
      });
      surface.commandLine = commandLineFor(surface);

      surfaces.push(surface);
      findings.push(...analyzeServerSurface(surface, source));
    }
  }

  if (surfaces.length === 0 && /"?(?:command|url|mcpServers|servers)"?\s*:/i.test(source)) {
    findings.push({
      severity: "low",
      code: "UNKNOWN_AGENT_CONFIG_SHAPE",
      title: "Agent config shape is not recognized",
      message: `${displayPath(file, root)} looks like an agent config but no servers were extracted.`,
      recommendation: "Open an issue with this config shape so the scanner can support it.",
      file,
      line: 1
    });
  }

  return { surfaces, findings };
}

function scanPackageJson(file, source, root) {
  const surfaces = [];
  const findings = [];
  let pkg;

  try {
    pkg = JSON.parse(source);
  } catch (error) {
    findings.push({
      severity: "medium",
      code: "UNREADABLE_PACKAGE_JSON",
      title: "package.json could not be parsed",
      message: `${displayPath(file, root)} is not valid JSON.`,
      recommendation: "Fix package.json syntax so agent-related scripts can be inspected.",
      file,
      evidence: error.message
    });
    return { surfaces, findings };
  }

  const scripts = pkg.scripts ?? {};
  for (const [name, script] of Object.entries(scripts)) {
    if (typeof script !== "string" || !isAgentRelatedScript(name, script)) {
      continue;
    }

    const surface = makeSurface({
      type: "package-script",
      name: `script:${name}`,
      file,
      root,
      command: script.split(/\s+/)[0],
      args: script.split(/\s+/).slice(1),
      rawText: script
    });
    surface.commandLine = commandLineFor(surface);

    const scriptFindings = analyzeCommandLine(script, surface, source);
    surfaces.push(surface);
    findings.push(...scriptFindings);
  }

  return { surfaces, findings };
}

function serverContainers(config) {
  const containers = [];

  if (isPlainObject(config.mcpServers)) {
    containers.push({ label: "mcpServers", servers: config.mcpServers });
  }
  if (isPlainObject(config.servers)) {
    containers.push({ label: "servers", servers: config.servers });
  }
  if (isPlainObject(config.mcp?.servers)) {
    containers.push({ label: "mcp.servers", servers: config.mcp.servers });
  }

  return containers;
}

function makeSurface({ type, name, file, root, command, args = [], url, env = {}, rawText }) {
  return {
    id: `${type}:${displayPath(file, root)}:${name}`,
    type,
    name,
    file: displayPath(file, root),
    absoluteFile: file,
    command,
    args,
    url,
    envKeys: Object.keys(env),
    env,
    rawText
  };
}

function normalizeArgs(args) {
  if (Array.isArray(args)) {
    return args.map((item) => String(item));
  }
  if (typeof args === "string") {
    return splitShellish(args);
  }
  return [];
}

function normalizeEnv(env) {
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    return {};
  }
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [key, String(value ?? "")]));
}

function splitShellish(value) {
  return String(value).match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^['"]|['"]$/g, "")) ?? [];
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAgentRelatedScript(name, script) {
  return /(?:mcp|agent|claude|codex|cursor|aider|openai|anthropic|gemini|copilot|llm)/i.test(`${name} ${script}`);
}

function compareFindings(a, b) {
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return (order[a.severity] ?? 5) - (order[b.severity] ?? 5) || String(a.file).localeCompare(String(b.file));
}

function unique(values) {
  return [...new Set(values)];
}

function displayPath(file, root) {
  if (!root) {
    return file;
  }
  const relative = path.relative(root, file);
  return relative && !relative.startsWith("..") ? relative.split(path.sep).join("/") : file;
}

function homeConfigCandidates() {
  const home = os.homedir();
  const appData = process.env.APPDATA;
  const candidates = [
    path.join(home, ".claude.json"),
    path.join(home, ".cursor", "mcp.json"),
    path.join(home, ".codex", "config.json"),
    path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    path.join(home, ".config", "Claude", "claude_desktop_config.json")
  ];

  if (appData) {
    candidates.push(path.join(appData, "Claude", "claude_desktop_config.json"));
  }

  return candidates;
}
