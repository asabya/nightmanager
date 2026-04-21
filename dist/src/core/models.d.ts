export interface ToolConfig {
    model?: string;
}
export interface ParsedModelReference {
    provider: string;
    modelId: string;
}
export declare function parseModelReference(input: string): ParsedModelReference | null;
export declare function loadToolConfig(configPath: string): ToolConfig | null;
