import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { type Model } from "@mariozechner/pi-ai";
export declare function runIsolatedSubagent(options: {
    ctx: ExtensionContext;
    model: Model<any>;
    systemPrompt: string;
    tools: any[];
    task: string;
    signal?: AbortSignal;
    timeoutMs: number;
}): Promise<string>;
