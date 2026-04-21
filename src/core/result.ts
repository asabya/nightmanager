function isTextBlock(value: unknown): value is { type: string; text?: string } {
  return typeof value === "object" && value !== null && "type" in value;
}

export function extractFinalText(messages: Array<{ role: string; content?: unknown }>): string {
  const finalAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  if (!Array.isArray(finalAssistant?.content)) return "";
  return finalAssistant.content
    .filter(isTextBlock)
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}
