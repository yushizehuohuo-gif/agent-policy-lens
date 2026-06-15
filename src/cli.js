#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "./scanner.js";
import { formatResult, shouldFail } from "./reporters.js";

const validFormats = new Set(["table", "json", "markdown", "md"]);
const validThresholds = new Set(["critical", "high", "medium", "low", "info", "none"]);

if (isDirectRun()) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`agent-policy-lens: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main(argv) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    process.stdout.write(helpText());
    return;
  }

  const result = await scan({
    root: parsed.root,
    includeHome: parsed.includeHome,
    maxDepth: parsed.maxDepth
  });
  const output = formatResult(result, parsed.format);

  if (parsed.out) {
    await fs.mkdir(path.dirname(path.resolve(parsed.out)), { recursive: true });
    await fs.writeFile(parsed.out, output, "utf8");
  } else {
    process.stdout.write(output);
  }

  if (shouldFail(result.summary, parsed.failOn)) {
    process.exitCode = 2;
  }
}

export function parseArgs(argv) {
  const args = [...argv];
  const parsed = {
    root: process.cwd(),
    format: "table",
    failOn: "none",
    includeHome: false,
    maxDepth: 6,
    out: null,
    help: false
  };

  if (args[0] === "scan") {
    args.shift();
  }

  while (args.length > 0) {
    const arg = args.shift();

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--include-home") {
      parsed.includeHome = true;
    } else if (arg === "--format") {
      parsed.format = requireValue(args, "--format");
      assertChoice(parsed.format, validFormats, "--format");
    } else if (arg.startsWith("--format=")) {
      parsed.format = arg.slice("--format=".length);
      assertChoice(parsed.format, validFormats, "--format");
    } else if (arg === "--fail-on") {
      parsed.failOn = requireValue(args, "--fail-on");
      assertChoice(parsed.failOn, validThresholds, "--fail-on");
    } else if (arg.startsWith("--fail-on=")) {
      parsed.failOn = arg.slice("--fail-on=".length);
      assertChoice(parsed.failOn, validThresholds, "--fail-on");
    } else if (arg === "--max-depth") {
      parsed.maxDepth = Number(requireValue(args, "--max-depth"));
    } else if (arg.startsWith("--max-depth=")) {
      parsed.maxDepth = Number(arg.slice("--max-depth=".length));
    } else if (arg === "--out" || arg === "-o") {
      parsed.out = requireValue(args, arg);
    } else if (arg.startsWith("--out=")) {
      parsed.out = arg.slice("--out=".length);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      parsed.root = path.resolve(arg);
    }
  }

  if (!Number.isFinite(parsed.maxDepth) || parsed.maxDepth < 0) {
    throw new Error("--max-depth must be a non-negative number");
  }

  return parsed;
}

function requireValue(args, flag) {
  const value = args.shift();
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function assertChoice(value, choices, flag) {
  if (!choices.has(value)) {
    throw new Error(`${flag} must be one of: ${[...choices].join(", ")}`);
  }
}

function helpText() {
  return `Agent Policy Lens

Inventory AI agent and MCP permissions before they surprise you.

Usage:
  agent-policy-lens [scan] [path] [options]
  aplens . --format markdown --out agent-policy-report.md

Options:
  --format <table|json|markdown>  Output format. Default: table
  --out <file>                    Write output to a file
  --fail-on <severity|none>       Exit 2 when highest risk is at least this level
  --include-home                  Also inspect known global agent config paths
  --max-depth <number>            Directory walk depth. Default: 6
  -h, --help                      Show this help

Examples:
  agent-policy-lens .
  agent-policy-lens . --format json
  agent-policy-lens . --fail-on high
  agent-policy-lens . --include-home --format markdown --out agent-policy-report.md
`;
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
