import { defineTool, createReadTool, createGrepTool, createFindTool, createLsTool, createBashTool, } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { resolveSubagentConfig } from "../core/models.js";
import { LEAN_RESPONSE_INSTRUCTIONS } from "../core/prompts.js";
import { renderSubagentCall, renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";
const oracleSchema = Type.Object({
    query: Type.String({ description: "Reasoning or debugging request" }),
});
const oracleWebSearchSchema = Type.Object({
    query: Type.Optional(Type.String({ description: "Single web search query" })),
    queries: Type.Optional(Type.Array(Type.String(), { description: "Multiple web search queries to run sequentially" })),
    numResults: Type.Optional(Type.Number({ minimum: 1, maximum: 20, description: "Results per query (default: 5, max: 20)" })),
    includeContent: Type.Optional(Type.Boolean({ description: "Include extracted page content when the provider supports it" })),
    recencyFilter: Type.Optional(Type.Union([
        Type.Literal("day"),
        Type.Literal("week"),
        Type.Literal("month"),
        Type.Literal("year"),
    ], { description: "Filter by recency" })),
    domainFilter: Type.Optional(Type.Array(Type.String(), { description: "Limit to domains; prefix with - to exclude" })),
    provider: Type.Optional(Type.Union([
        Type.Literal("auto"),
        Type.Literal("exa"),
        Type.Literal("perplexity"),
        Type.Literal("gemini"),
    ], { description: "Search provider (default: auto)" })),
});
const oracleCodeSearchSchema = Type.Object({
    query: Type.String({ description: "Programming question, API, library, or debugging topic to search for" }),
    maxTokens: Type.Optional(Type.Integer({ minimum: 1000, maximum: 50000, description: "Maximum tokens of context to return (default: 5000)" })),
});
const PI_WEB_ACCESS_SEARCH_MODULE = "pi-web-access/gemini-search.ts";
const PI_WEB_ACCESS_CODE_SEARCH_MODULE = "pi-web-access/code-search.ts";
const EXA_MCP_URL = "https://mcp.exa.ai/mcp";
const ORACLE_SYSTEM_PROMPT = `You are Oracle, a deep reasoning specialist for software debugging and nuanced technical planning.
Investigate tricky problems, weigh competing explanations, and recommend the best next action.
You are not responsible for implementing changes or editing files.

Read-only in spirit: inspect code, search external sources, and run safe verification commands, but do not modify the repository.
Never use relative paths in final answers. Always use absolute paths for local files and full URLs for web sources.

## External Research Tools
- Use web_search for current/external facts, release notes, issue reports, and public documentation not present in the repository.
- Use code_search for remote code examples, API usage patterns, and library behavior from public code/docs.
- Prefer local repository evidence first for project-specific behavior; use external evidence to resolve ambiguous dependencies or time-sensitive facts.
- Cite external evidence by URL in the final answer.

## Investigation Protocol
1. State the observation before interpreting it.
2. Consider 2-3 hypotheses when ambiguity exists.
3. Gather evidence for and against the strongest hypotheses.
4. Rank by confidence and evidence strength.
5. End with a best explanation or one discriminating probe.

${LEAN_RESPONSE_INSTRUCTIONS}

## Final Response Format
Assessment: best current explanation in one sentence.
Evidence:
- /absolute/path/file:line, full URL, or command — decisive detail.
Hypotheses: ranked short list with confidence.
Recommendation: concrete action.
Implementation handoff: root cause, recommended fix/approach, risks, constraints, and verification guidance for a later worker, or None.
Next probe: single highest-value probe, or None.`;
async function loadWebSearchModule() {
    try {
        const moduleName = PI_WEB_ACCESS_SEARCH_MODULE;
        return await import(moduleName);
    }
    catch {
        // pi-web-access is a Pi TypeScript package. In runtimes that do not transpile
        // node_modules .ts files, keep Oracle usable with the same Exa MCP endpoint and
        // tool names used by pi-web-access.
        return { search: searchWithPiWebAccessExaMcp };
    }
}
async function loadCodeSearchModule() {
    try {
        const moduleName = PI_WEB_ACCESS_CODE_SEARCH_MODULE;
        return await import(moduleName);
    }
    catch {
        return { executeCodeSearch: executePiWebAccessCodeSearchFallback };
    }
}
function requestSignal(signal) {
    const timeout = AbortSignal.timeout(60_000);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
async function callPiWebAccessExaMcp(toolName, args, signal) {
    const response = await fetch(EXA_MCP_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: toolName, arguments: args },
        }),
        signal: requestSignal(signal),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Exa MCP error ${response.status}: ${errorText.slice(0, 300)}`);
    }
    const body = await response.text();
    const dataLines = body.split("\n").filter(line => line.startsWith("data:"));
    let parsed = null;
    for (const line of dataLines) {
        const payload = line.slice(5).trim();
        if (!payload)
            continue;
        try {
            const candidate = JSON.parse(payload);
            if (candidate?.result || candidate?.error) {
                parsed = candidate;
                break;
            }
        }
        catch {
        }
    }
    if (!parsed) {
        try {
            const candidate = JSON.parse(body);
            if (candidate?.result || candidate?.error)
                parsed = candidate;
        }
        catch {
        }
    }
    if (!parsed)
        throw new Error("Exa MCP returned an empty response");
    if (parsed.error) {
        const code = typeof parsed.error.code === "number" ? ` ${parsed.error.code}` : "";
        throw new Error(`Exa MCP error${code}: ${parsed.error.message || "Unknown error"}`);
    }
    if (parsed.result?.isError) {
        const message = parsed.result.content
            ?.find(item => item.type === "text" && typeof item.text === "string")
            ?.text?.trim();
        throw new Error(message || "Exa MCP returned an error");
    }
    const text = parsed.result?.content
        ?.find(item => item.type === "text" && typeof item.text === "string" && item.text.trim().length > 0)
        ?.text;
    if (!text)
        throw new Error("Exa MCP returned empty content");
    return text;
}
function parsePiWebAccessMcpResults(text) {
    const blocks = text.split(/(?=^Title: )/m).filter(block => block.trim().length > 0);
    const parsed = blocks.map(block => {
        const title = block.match(/^Title: (.+)/m)?.[1]?.trim() ?? "";
        const url = block.match(/^URL: (.+)/m)?.[1]?.trim() ?? "";
        let content = "";
        const textStart = block.indexOf("\nText: ");
        if (textStart >= 0) {
            content = block.slice(textStart + 7).trim();
        }
        else {
            const highlights = block.match(/\nHighlights:\s*\n/);
            if (highlights?.index != null)
                content = block.slice(highlights.index + highlights[0].length).trim();
        }
        return { title, url, content: content.replace(/\n---\s*$/, "").trim() };
    }).filter(result => result.url.length > 0);
    return parsed.length > 0 ? parsed : null;
}
function buildFallbackWebQuery(query, options) {
    const parts = [query];
    for (const domain of options?.domainFilter ?? []) {
        const trimmed = domain.trim();
        if (!trimmed)
            continue;
        parts.push(trimmed.startsWith("-") ? `-site:${trimmed.slice(1)}` : `site:${trimmed}`);
    }
    if (options?.recencyFilter) {
        const now = new Date();
        const recencyHints = {
            day: "past 24 hours",
            week: "past week",
            month: `${now.toLocaleString("en", { month: "long" })} ${now.getFullYear()}`,
            year: String(now.getFullYear()),
        };
        parts.push(recencyHints[options.recencyFilter]);
    }
    return parts.join(" ");
}
async function searchWithPiWebAccessExaMcp(query, options = {}) {
    const enrichedQuery = buildFallbackWebQuery(query, options);
    const text = await callPiWebAccessExaMcp("web_search_exa", {
        query: enrichedQuery,
        numResults: options.numResults ?? 5,
        livecrawl: "fallback",
        type: "auto",
        contextMaxCharacters: options.includeContent ? 50_000 : 3000,
    }, options.signal);
    const parsed = parsePiWebAccessMcpResults(text);
    if (!parsed)
        return { answer: text, provider: "exa", results: [] };
    return {
        provider: "exa",
        answer: parsed
            .map((result, index) => `${result.content.replace(/\s+/g, " ").trim().slice(0, 500)}\nSource: ${result.title || `Source ${index + 1}`} (${result.url})`)
            .join("\n\n"),
        results: parsed.map((result, index) => ({ title: result.title || `Source ${index + 1}`, url: result.url, snippet: "" })),
        inlineContent: options.includeContent
            ? parsed.filter(result => result.content).map(result => ({ title: result.title, url: result.url, content: result.content, error: null }))
            : undefined,
    };
}
async function executePiWebAccessCodeSearchFallback(_toolCallId, params, signal) {
    const query = params.query.trim();
    const maxTokens = params.maxTokens ?? 5000;
    if (!query) {
        return {
            content: [{ type: "text", text: "Error: No query provided." }],
            details: { query: "", maxTokens, error: "No query provided" },
        };
    }
    try {
        const text = await callPiWebAccessExaMcp("get_code_context_exa", { query, tokensNum: maxTokens }, signal);
        return { content: [{ type: "text", text }], details: { query, maxTokens } };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error: ${message}` }], details: { query, maxTokens, error: message } };
    }
}
function normalizeQueries(params) {
    const raw = Array.isArray(params.queries) ? params.queries : (params.query !== undefined ? [params.query] : []);
    return raw.map(q => q.trim()).filter(q => q.length > 0);
}
function clampInteger(value, fallback, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, Math.floor(value)));
}
function truncateForTool(text, maxChars) {
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars]` : text;
}
function formatOracleWebSearchResult(args) {
    const lines = [`## Query: ${args.query}`];
    if (args.provider)
        lines.push(`Provider: ${args.provider}`);
    if (args.error) {
        lines.push(`Error: ${args.error}`);
        return lines.join("\n");
    }
    const answer = args.answer?.trim();
    if (answer)
        lines.push("", answer);
    const results = args.results ?? [];
    if (results.length > 0) {
        lines.push("", "Sources:");
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            lines.push(`${i + 1}. ${result.title || `Source ${i + 1}`}`);
            if (result.url)
                lines.push(`   ${result.url}`);
            if (result.snippet)
                lines.push(`   ${result.snippet}`);
        }
    }
    const inlineContent = (args.inlineContent ?? []).filter(item => item.content || item.error);
    if (inlineContent.length > 0) {
        lines.push("", "Extracted content:");
        for (let i = 0; i < inlineContent.length; i++) {
            const item = inlineContent[i];
            lines.push(`\n### ${item.title || item.url || `Content ${i + 1}`}`);
            if (item.url)
                lines.push(item.url);
            if (item.error)
                lines.push(`Error: ${item.error}`);
            if (item.content)
                lines.push(truncateForTool(item.content, 3000));
        }
    }
    if (!answer && results.length === 0 && inlineContent.length === 0)
        lines.push("No results returned.");
    return lines.join("\n");
}
const oracleWebSearchTool = defineTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web via pi-web-access (Exa, Perplexity, or Gemini fallback) and return synthesized answers with sources.",
    promptSnippet: "Use web_search for current/external facts, release notes, issue reports, and public documentation not present in the local repository.",
    parameters: oracleWebSearchSchema,
    renderCall(args, theme) {
        const query = typeof args.query === "string" ? args.query : Array.isArray(args.queries) ? `${args.queries.length} queries` : "(no query)";
        const display = query.length > 70 ? `${query.slice(0, 67)}...` : query;
        return new Text(theme.fg("toolTitle", theme.bold("web_search ")) + theme.fg("accent", display), 0, 0);
    },
    renderResult(result, { expanded }, theme) {
        const details = result.details;
        if (details?.error)
            return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
        const summary = theme.fg("success", `${details?.successfulQueries ?? 0}/${details?.queryCount ?? 0} queries`) +
            theme.fg("muted", ` · ${details?.totalResults ?? 0} sources`);
        if (!expanded)
            return new Text(summary, 0, 0);
        const text = result.content[0];
        return new Text(summary + "\n" + theme.fg("dim", text?.type === "text" ? truncateForTool(text.text, 1200) : ""), 0, 0);
    },
    async execute(_toolCallId, params, signal, onUpdate) {
        const queries = normalizeQueries(params);
        if (queries.length === 0) {
            return {
                content: [{ type: "text", text: "Error: No query provided. Use query or queries." }],
                details: { error: "empty_query" },
                isError: true,
            };
        }
        try {
            const { search } = await loadWebSearchModule();
            const sections = [];
            const details = [];
            let totalResults = 0;
            let successfulQueries = 0;
            const numResults = clampInteger(params.numResults, 5, 1, 20);
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                onUpdate?.({
                    content: [{ type: "text", text: `Searching ${i + 1}/${queries.length}: ${query}` }],
                    details: { phase: "search", progress: i / queries.length, currentQuery: query },
                });
                try {
                    const result = await search(query, {
                        provider: params.provider,
                        numResults,
                        includeContent: params.includeContent ?? false,
                        recencyFilter: params.recencyFilter,
                        domainFilter: params.domainFilter,
                        signal,
                    });
                    const sourceCount = result.results?.length ?? 0;
                    totalResults += sourceCount;
                    successfulQueries += 1;
                    details.push({ query, provider: result.provider, sourceCount });
                    sections.push(formatOracleWebSearchResult({ query, ...result }));
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    details.push({ query, sourceCount: 0, error: message });
                    sections.push(formatOracleWebSearchResult({ query, error: message }));
                }
            }
            return {
                content: [{ type: "text", text: truncateForTool(sections.join("\n\n---\n\n"), 45000) }],
                details: { queryCount: queries.length, successfulQueries, totalResults, queries: details },
                isError: successfulQueries === 0,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: "text", text: `Error: ${message}` }],
                details: { error: message },
                isError: true,
            };
        }
    },
});
const oracleCodeSearchTool = defineTool({
    name: "code_search",
    label: "Code Search",
    description: "Search remote code examples, documentation, and API references via pi-web-access Exa MCP.",
    promptSnippet: "Use code_search for remote API/library examples, docs, and implementation patterns before diagnosing library behavior.",
    parameters: oracleCodeSearchSchema,
    renderCall(args, theme) {
        const query = typeof args.query === "string" ? args.query : "(no query)";
        const display = query.length > 70 ? `${query.slice(0, 67)}...` : query;
        return new Text(theme.fg("toolTitle", theme.bold("code_search ")) + theme.fg("accent", display), 0, 0);
    },
    renderResult(result, { expanded }, theme) {
        const details = result.details;
        if (details?.error)
            return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
        const summary = theme.fg("success", "code context returned") + theme.fg("muted", ` (${details?.maxTokens ?? 5000} tokens max)`);
        if (!expanded)
            return new Text(summary, 0, 0);
        const text = result.content[0];
        return new Text(summary + "\n" + theme.fg("dim", text?.type === "text" ? truncateForTool(text.text, 1200) : ""), 0, 0);
    },
    async execute(toolCallId, params, signal) {
        const query = params.query.trim();
        if (!query) {
            return {
                content: [{ type: "text", text: "Error: No query provided." }],
                details: { query: "", maxTokens: params.maxTokens ?? 5000, error: "empty_query" },
                isError: true,
            };
        }
        try {
            const { executeCodeSearch } = await loadCodeSearchModule();
            const maxTokens = clampInteger(params.maxTokens, 5000, 1000, 50000);
            const result = await executeCodeSearch(toolCallId, { query, maxTokens }, signal);
            return { ...result, isError: !!result.details.error };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: "text", text: `Error: ${message}` }],
                details: { query, maxTokens: params.maxTokens ?? 5000, error: message },
                isError: true,
            };
        }
    },
});
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
    renderCall(args, _theme, context) {
        return renderSubagentCall("oracle", args.query ?? "", context.isPartial, context.isError, context);
    },
    renderResult(result, options, theme, context) {
        const transcript = result.details?.transcript;
        if (transcript)
            return renderSubagentResult(transcript, options, theme, context);
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (!params.query.trim()) {
            return {
                content: [{ type: "text", text: "Error: Please provide a non-empty search query." }],
                details: { error: "empty_query" },
                isError: true,
            };
        }
        const subagentConfig = resolveSubagentConfig(ctx, "oracle");
        const model = subagentConfig.model;
        if (!model) {
            return {
                content: [{ type: "text", text: "Error: No model available for oracle subagent." }],
                details: { error: "no_model", configPath: subagentConfig.configPath },
                isError: true,
            };
        }
        const result = await runIsolatedSubagent({
            subagentName: "oracle",
            onUpdate: (partial) => {
                _onUpdate?.({
                    content: partial.content,
                    details: { query: params.query, transcript: partial.details },
                });
            },
            ctx,
            model,
            thinkingLevel: subagentConfig.thinkingLevel,
            systemPrompt: ORACLE_SYSTEM_PROMPT,
            tools: [
                createReadTool(ctx.cwd),
                createGrepTool(ctx.cwd),
                createFindTool(ctx.cwd),
                createLsTool(ctx.cwd),
                createBashTool(ctx.cwd),
                oracleWebSearchTool,
                oracleCodeSearchTool,
            ],
            task: params.query,
            signal,
            timeoutMs: 300_000,
        });
        return {
            content: [{ type: "text", text: result.finalText }],
            details: { query: params.query, transcript: result.details },
        };
    },
});
//# sourceMappingURL=oracle.js.map