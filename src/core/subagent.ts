import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Agent } from "@mariozechner/pi-agent-core";
import { stream, type Model } from "@mariozechner/pi-ai";
import { extractFinalText } from "./result.js";

export async function runIsolatedSubagent(options: {
  ctx: ExtensionContext;
  model: Model<any>;
  systemPrompt: string;
  tools: any[];
  task: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<string> {
  const timeoutAbort = new AbortController();
  const timeoutId = setTimeout(() => timeoutAbort.abort(), options.timeoutMs);
  const combinedSignal = options.signal ? AbortSignal.any([options.signal, timeoutAbort.signal]) : timeoutAbort.signal;

  try {
    const resolvedAuth = await options.ctx.modelRegistry.getApiKeyAndHeaders(options.model);
    if (!resolvedAuth.ok) throw new Error(resolvedAuth.error);

    const agent = new Agent({
      initialState: {
        systemPrompt: options.systemPrompt,
        model: options.model,
        tools: options.tools,
      },
      streamFn: (messages, context, streamOptions) => stream(messages, context, {
        ...streamOptions,
        signal: combinedSignal,
        apiKey: resolvedAuth.apiKey,
        headers: resolvedAuth.headers,
      }),
    });

    await agent.prompt({
      role: "user",
      content: [{ type: "text", text: options.task }],
      timestamp: Date.now(),
    });
    await agent.waitForIdle();
    return extractFinalText(agent.state.messages as Array<{ role: string; content?: unknown }>);
  } finally {
    clearTimeout(timeoutId);
  }
}
