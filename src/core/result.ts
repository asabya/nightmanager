export function extractFinalText(messages: Array<{ role: string; content?: Array<{ type: string; text?: string }> }>): string {
  const finalAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  if (!finalAssistant?.content) return "";
  return finalAssistant.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}
