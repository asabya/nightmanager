function isTextBlock(value) {
    return typeof value === "object" && value !== null && "type" in value;
}
export function extractFinalText(messages) {
    const finalAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!Array.isArray(finalAssistant?.content))
        return "";
    return finalAssistant.content
        .filter(isTextBlock)
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n")
        .trim();
}
//# sourceMappingURL=result.js.map