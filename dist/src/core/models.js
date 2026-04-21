import { existsSync, readFileSync } from "node:fs";
export function parseModelReference(input) {
    const parts = input.split("/");
    if (parts.length < 2)
        return null;
    const [provider, ...rest] = parts;
    const modelId = rest.join("/");
    if (!provider || !modelId)
        return null;
    return { provider, modelId };
}
export function loadToolConfig(configPath) {
    if (!existsSync(configPath))
        return null;
    try {
        return JSON.parse(readFileSync(configPath, "utf-8"));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=models.js.map