import { existsSync, readFileSync } from "node:fs";

export interface ToolConfig {
  model?: string;
}

export interface ParsedModelReference {
  provider: string;
  modelId: string;
}

export function parseModelReference(input: string): ParsedModelReference | null {
  const parts = input.split("/");
  if (parts.length < 2) return null;
  const [provider, ...rest] = parts;
  const modelId = rest.join("/");
  if (!provider || !modelId) return null;
  return { provider, modelId };
}

export function loadToolConfig(configPath: string): ToolConfig | null {
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as ToolConfig;
  } catch {
    return null;
  }
}
