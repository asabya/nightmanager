// Real integration tests for subagent tools via Pi CLI
// IMPORTANT: These tests verify the tools work with an actual LLM, not mocked
// Run with: npx vitest run tests/integration/real.test.ts -t "test name"

import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";

const PROJECT_DIR = "/Users/sabyasachipatra/.pi/agent/extensions/nightmanager";

/**
 * Run a Pi command with the nightmanager extension via spawn
 */
function runPi(task: string, timeoutMs = 60000): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const cmd = `npx pi -p --no-session "${task}" --model opencode/big-pickle`;
    
    const child = spawn("sh", ["-c", cmd], { cwd: PROJECT_DIR });
    
    let stdout = "";
    let stderr = "";
    let killed = false;
    
    child.stdout?.on?.("data", (d) => { stdout += d.toString(); });
    child.stderr?.on?.("data", (d) => { stderr += d.toString(); });
    
    const timeoutHandle = setTimeout(() => {
      killed = true;
      child.kill();
    }, timeoutMs);
    
    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      if (killed) {
        resolve({ stdout, stderr, exitCode: -1 });
      } else {
        resolve({ stdout, stderr, exitCode: code });
      }
    });
    
    child.on("error", () => {
      clearTimeout(timeoutHandle);
      resolve({ stdout, stderr, exitCode: -1 });
    });
  });
}

// Mark whole suite as skipped by default - run individually when needed
// npx vitest run tests/integration/real.test.ts -t "manager can route"
describe.skip("real integration: subagent tools via CLI", () => {
  describe("manager tool", () => {
    it("can route a file search to finder to find package.json", async () => {
      const result = await runPi("Use manager to find package.json file", 90000);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("package.json");
    }, 90000);

    it("can route a reasoning task to oracle", async () => {
      const result = await runPi("Use manager to explain why oracle exists", 120000);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(20);
    }, 120000);
  });
});