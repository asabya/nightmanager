import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  defineTool,
  createReadTool,
  createGrepTool,
  createFindTool,
  createLsTool,
  createBashTool,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { runIsolatedSubagent } from "../core/subagent.js";

const oracleSchema = Type.Object({
  query: Type.String({ description: "Reasoning or debugging request" }),
});

type OracleInput = Static<typeof oracleSchema>;

const ORACLE_CONFIG_PATH = join(homedir(), ".pi", "agent", "oracle.json");

const ORACLE_SYSTEM_PROMPT = `You are Oracle, a deep reasoning specialist for software debugging and nuanced technical planning.
Your mission is to investigate tricky problems, generate competing explanations, gather evidence, and recommend the best next action.
You are NOT responsible for implementing changes or editing files.

Read-only in spirit: inspect code and run safe verification commands, but do not modify the repository.
Never use relative paths in your final answer. Always use absolute paths.

## Investigation Protocol
1. Restate the observation precisely before interpreting it.
2. Generate 2-3 competing hypotheses when ambiguity exists.
3. Gather evidence for and against each hypothesis.
4. Rank the remaining hypotheses by confidence and evidence strength.
5. End with either a best explanation or a discriminating probe.

## Output Format
Structure your response EXACTLY as follows.

## Observation
[What was observed, without interpretation]

## Hypothesis Table
| Rank | Hypothesis | Confidence | Evidence Strength |
|------|------------|------------|-------------------|
| 1 | ... | High / Medium / Low | Strong / Moderate / Weak |

## Evidence For
- Hypothesis 1: ...

## Evidence Against / Gaps
- Hypothesis 1: ...

## Current Best Explanation
[Best current explanation]

## Recommendations
1. [Concrete action]
2. [Concrete action]

## Discriminating Probe
[Single highest-value next step]`;

function resolveOracleModel(ctx: ExtensionContext) {
  const configured = loadToolConfig(ORACLE_CONFIG_PATH)?.model;
  const parsed = configured ? parseModelReference(configured) : null;
  return parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
}

export const oracleTool = defineTool({
  name: "oracle",
  label: "Oracle",
  description: "Launch a deep-reasoning subagent for debugging tricky problems and nuanced planning.",
  promptSnippet: "Use oracle when you need deep reasoning for debugging, root-cause analysis, or trade-off-aware planning.",
  promptGuidelines: [
    "Use oracle when the main agent is stuck between multiple explanations and needs evidence-backed reasoning.",
    "The oracle subagent excels at debugging tricky failures, ranking hypotheses, and recommending the best next probe.",
  ],
  parameters: oracleSchema,
  async execute(_toolCallId, params: OracleInput, signal, _onUpdate, ctx) {
    if (!params.query.trim()) {
      return {
        content: [{ type: "text", text: "Error: Please provide a non-empty search query." }],
        details: { error: "empty_query" },
        isError: true,
      };
    }

    const model = resolveOracleModel(ctx);
    if (!model) {
      return {
        content: [{ type: "text", text: "Error: No model available for oracle subagent." }],
        details: { error: "no_model", configPath: ORACLE_CONFIG_PATH },
        isError: true,
      };
    }

    const text = await runIsolatedSubagent({
      ctx,
      model,
      systemPrompt: ORACLE_SYSTEM_PROMPT,
      tools: [
        createReadTool(ctx.cwd),
        createGrepTool(ctx.cwd),
        createFindTool(ctx.cwd),
        createLsTool(ctx.cwd),
        createBashTool(ctx.cwd),
      ],
      task: params.query,
      signal,
      timeoutMs: 300_000,
    });

    return {
      content: [{ type: "text", text }],
      details: { query: params.query },
    };
  },
});
