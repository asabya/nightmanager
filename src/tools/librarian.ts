import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  defineTool,
  createReadTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { resolveSubagentConfig } from "../core/models.js";
import { LEAN_RESPONSE_INSTRUCTIONS } from "../core/prompts.js";
import { renderSubagentCall, renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";
import { researchCodeSearchTool, researchWebSearchTool } from "./oracle.js";

const librarianSchema = Type.Object({
  query: Type.String({ description: "Open-source library or upstream repository research request" }),
});

type LibrarianInput = Static<typeof librarianSchema>;

const execFileAsync = promisify(execFile);

const githubDiscoverySchema = Type.Object({
  query: Type.String({ description: "Package, library, or repo name to resolve to a canonical GitHub upstream" }),
  maxCandidates: Type.Optional(Type.Integer({ minimum: 2, maximum: 10, description: "Candidate count to inspect (default: 5)" })),
});

type GithubDiscoveryInput = Static<typeof githubDiscoverySchema>;

const githubCloneSchema = Type.Object({
  repo: Type.String({ description: "GitHub repo as owner/name, https://github.com/owner/name, or git@github.com:owner/name.git" }),
  ref: Type.Optional(Type.String({ description: "Requested branch, tag, or commit. If supplied, checkout must succeed." })),
});

type GithubCloneInput = Static<typeof githubCloneSchema>;

type GithubSearchItem = {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  fork?: boolean;
  archived?: boolean;
};

function normalizeGithubRepo(repo: string): string | null {
  const trimmed = repo.trim();
  const match = trimmed.match(/github\.com[:/]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[\s#?].*)?$/i)
    ?? trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) return null;
  const owner = match[1];
  const name = match[2].replace(/\.git$/i, "");
  if (!owner || !name) return null;
  return `${owner}/${name}`;
}

function cloneDirName(repo: string, ref?: string): string {
  return `librarian-${repo.replace(/[^A-Za-z0-9_.-]+/g, "-")}${ref ? `-${ref.replace(/[^A-Za-z0-9_.-]+/g, "-")}` : ""}-`;
}

async function cloneGithubRepo(repoInput: string, ref: string | undefined, signal?: AbortSignal) {
  const repo = normalizeGithubRepo(repoInput);
  if (!repo) throw new Error("repo must be a GitHub owner/name or github.com URL");
  const dir = await mkdtemp(join(tmpdir(), cloneDirName(repo, ref)));
  const url = `https://github.com/${repo}.git`;
  try {
    const cloneArgs = ["clone", "--depth", "1"];
    if (ref) cloneArgs.push("--branch", ref);
    cloneArgs.push(url, dir);
    await execFileAsync("git", cloneArgs, { signal, timeout: 120_000, maxBuffer: 1024 * 1024 });
    const { stdout } = await execFileAsync("git", ["-C", dir, "rev-parse", "--verify", "HEAD"], { signal, timeout: 30_000 });
    const commit = stdout.trim();
    return { repo, url: `https://github.com/${repo}`, path: dir, ref: ref ?? "HEAD", commit, permalinkBase: `https://github.com/${repo}/blob/${commit}` };
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(ref ? `failed to clone ${repo} at requested ref ${ref}: ${message}` : `failed to clone ${repo}: ${message}`);
  }
}

function githubSearchQuery(query: string): string {
  return `${query.trim()} in:name,description fork:false archived:false`;
}

function chooseCanonicalGithubRepo(query: string, items: GithubSearchItem[]) {
  const candidates = items.filter(item => item.full_name && item.html_url && !item.fork && !item.archived).slice(0, 5);
  if (candidates.length === 0) return { status: "not_found" as const, candidates };

  const normalizedQuery = query.trim().toLowerCase();
  const exact = candidates.filter(item => {
    const fullName = item.full_name!.toLowerCase();
    const name = fullName.split("/").at(-1) ?? fullName;
    return fullName === normalizedQuery || name === normalizedQuery;
  });
  if (exact.length === 1) return { status: "found" as const, repo: exact[0], candidates };
  if (exact.length > 1) return { status: "ambiguous" as const, candidates: exact };

  const [first, second] = candidates;
  const firstStars = first?.stargazers_count ?? 0;
  const secondStars = second?.stargazers_count ?? 0;
  if (first && firstStars >= Math.max(100, secondStars * 3)) return { status: "found" as const, repo: first, candidates };
  return { status: "ambiguous" as const, candidates };
}

export const githubRepoDiscoveryTool = defineTool({
  name: "github_repo_discovery",
  label: "GitHub Repo Discovery",
  description: "Resolve a package/library name to a canonical GitHub upstream; fails closed on ambiguity.",
  promptSnippet: "Use github_repo_discovery before answering package-only library questions; stop if it reports ambiguity.",
  parameters: githubDiscoverySchema,
  renderCall(args, theme) {
    return new Text(theme.fg("toolTitle", theme.bold("github_repo_discovery ")) + theme.fg("accent", args.query ?? ""), 0, 0);
  },
  renderResult(result, _options, theme) {
    const details = result.details as { status?: string; repo?: string; candidates?: string[]; error?: string } | undefined;
    if (details?.error) return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
    return new Text(`${details?.status ?? "unknown"}${details?.repo ? ` · ${details.repo}` : ""}`, 0, 0);
  },
  async execute(_toolCallId, params: GithubDiscoveryInput, signal) {
    const query = params.query.trim();
    if (!query) return { content: [{ type: "text", text: "Error: No query provided." }], details: { error: "empty_query" }, isError: true };
    const repo = normalizeGithubRepo(query);
    if (repo) {
      return { content: [{ type: "text", text: `Canonical GitHub repo: https://github.com/${repo}` }], details: { status: "found", repo } };
    }

    try {
      const searchUrl = new URL("https://api.github.com/search/repositories");
      searchUrl.searchParams.set("q", githubSearchQuery(query));
      searchUrl.searchParams.set("sort", "stars");
      searchUrl.searchParams.set("order", "desc");
      searchUrl.searchParams.set("per_page", String(params.maxCandidates ?? 5));
      const response = await fetch(searchUrl, { headers: { "Accept": "application/vnd.github+json", "User-Agent": "nightmanager-librarian" }, signal });
      if (!response.ok) throw new Error(`GitHub search failed ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const body = await response.json() as { items?: GithubSearchItem[] };
      const decision = chooseCanonicalGithubRepo(query, body.items ?? []);
      const candidates = decision.candidates.map(item => `${item.full_name} (${item.stargazers_count ?? 0} stars)`).filter(Boolean);
      if (decision.status === "found") {
        return {
          content: [{ type: "text", text: `Canonical GitHub repo: ${decision.repo.html_url}\nCandidates inspected:\n- ${candidates.join("\n- ")}` }],
          details: { status: "found", repo: decision.repo.full_name, candidates },
        };
      }
      return {
        content: [{ type: "text", text: `Ambiguous or missing GitHub upstream for '${query}'. Do not guess. Candidates inspected:\n- ${candidates.join("\n- ") || "None"}` }],
        details: { status: decision.status, candidates },
        isError: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], details: { error: message }, isError: true };
    }
  },
});

export const githubCloneTool = defineTool({
  name: "github_clone",
  label: "GitHub Clone",
  description: "Clone a GitHub repo into /tmp and optionally checkout a requested version/ref; never writes outside /tmp.",
  promptSnippet: "Use github_clone for every named or discovered GitHub repo before local analysis; requested refs must succeed.",
  parameters: githubCloneSchema,
  renderCall(args, theme) {
    const ref = typeof args.ref === "string" ? ` @ ${args.ref}` : "";
    return new Text(theme.fg("toolTitle", theme.bold("github_clone ")) + theme.fg("accent", `${args.repo ?? ""}${ref}`), 0, 0);
  },
  renderResult(result, _options, theme) {
    const details = result.details as { path?: string; commit?: string; error?: string } | undefined;
    if (details?.error) return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
    const commit = details?.commit ? ` @ ${details.commit.slice(0, 12)}` : "";
    return new Text(theme.fg("success", `${details?.path ?? "cloned"}${commit}`), 0, 0);
  },
  async execute(_toolCallId, params: GithubCloneInput, signal) {
    try {
      const cloned = await cloneGithubRepo(params.repo, params.ref?.trim() || undefined, signal);
      return {
        content: [{ type: "text", text: `Cloned ${cloned.url} to ${cloned.path} at ${cloned.ref} (${cloned.commit}). Permalink base: ${cloned.permalinkBase}. Analyze tests/examples first, then production source, then README/docs only if needed.` }],
        details: cloned,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], details: { error: message }, isError: true };
    }
  },
});

export const LIBRARIAN_SYSTEM_PROMPT = `You are Librarian, a read-only research specialist for external open-source codebases.
Answer library, framework, SDK, and upstream repository questions with evidence rather than guesses.
You are not responsible for implementing changes or editing files.

Read-only: do not create, modify, or delete files in the user's repository. You may clone public upstream repositories into /tmp for inspection when needed. Never write findings into files; return them as message text.
Never use relative paths in final answers. Use absolute local paths for /tmp clones during analysis only; final source-code claims must use strict GitHub permalinks pinned to the cloned commit.

## Research Tools
- Use github_repo_discovery first when the user names only a package or library; it fails closed on ambiguous GitHub upstreams.
- Use github_clone for every named or discovered GitHub repo before local analysis; it clones only into /tmp.
- Use web_search for official docs, release notes, current external facts, and secondary validation after GitHub-first discovery.
- Use code_search for public code examples, API usage patterns, tests, and documentation snippets.
- If upstream identification is ambiguous, state the ambiguity and stop instead of guessing.

## Evidence Policy
1. Prefer upstream source code first.
2. Inspect tests and examples before README or docs.
3. Use production source when tests/examples are insufficient.
4. Treat source code as authoritative over docs when they conflict.
5. Consult official docs only when source-code evidence is insufficient or unavailable.
6. Back every factual source-code claim with a strict GitHub permalink; include direct quotes/snippets when available.
7. Strict permalink format: https://github.com/<owner>/<repo>/blob/<commit>/<path>#L<start>-L<end> (or #L<line> for one line). Use the github_clone commit/permalinkBase metadata; do not cite branch names or local-only paths as final evidence for code claims.
8. If decisive source/code evidence remains weak, missing, or ambiguous after reasonable inspection, state the uncertainty and stop instead of filling gaps with docs or guesses.

## Repository Handling
- If the user names one or more GitHub repos, clone them into /tmp with github_clone and inspect local clones.
- Prefer the latest default branch HEAD unless the user specifies a version; when specified, pass that ref to github_clone and stop if checkout fails.
- For comparisons, handle 2-3 repos by default. Compare 4-5 only when the user explicitly provides them. For 6+ repos, split into named batches, summarize each batch, then provide only cross-batch conclusions supported by permalink evidence.
- Rank findings in this order: API correctness, closest fit to the user's question, recency/current implementation, then documentation/example quality.
- Choose the final format to fit the question: ranked bullets, comparison table, side-by-side repo summary, or another concise evidence-first structure.

${LEAN_RESPONSE_INSTRUCTIONS}

## Final Response Format
Summary: one sentence answer.
Evidence:
- strict GitHub permalink pinned to commit with line number(s) — quote/snippet and decisive detail.
- official URL only for docs/current-fact claims when code evidence is unavailable or insufficient.
Findings: ranked bullets, comparison table, side-by-side summary, or another format suited to the question.
Uncertainty: weak or ambiguous evidence and whether you stopped because evidence was insufficient, or None.
Next: one concrete follow-up, or None.`;

export const librarianTool = defineTool({
  name: "librarian",
  label: "Librarian",
  description: "Launch a read-only research subagent for evidence-backed open-source library and upstream repository analysis.",
  promptSnippet: "Use librarian for OSS/library research that needs canonical repo discovery, code-first evidence, and GitHub permalinks.",
  promptGuidelines: [
    "Use librarian for questions about external libraries, SDKs, frameworks, and upstream GitHub repositories.",
    "The librarian subagent prioritizes tests/examples/source over docs and uses web_search and code_search for research.",
  ],
  parameters: librarianSchema,
  renderCall(args, _theme, context) {
    return renderSubagentCall("librarian", args.query ?? "", context.isPartial, context.isError, context);
  },
  renderResult(result, options, theme, context) {
    const transcript = (result.details as { transcript?: unknown } | undefined)?.transcript;
    if (transcript) return renderSubagentResult(transcript as any, options, theme, context);
    const text = result.content[0];
    return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
  },
  async execute(_toolCallId, params: LibrarianInput, signal, _onUpdate, ctx) {
    if (!params.query.trim()) {
      return {
        content: [{ type: "text", text: "Error: Please provide a non-empty research query." }],
        details: { error: "empty_query" },
        isError: true,
      };
    }

    const subagentConfig = resolveSubagentConfig(ctx, "librarian");
    const model = subagentConfig.model;
    if (!model) {
      return {
        content: [{ type: "text", text: "Error: No model available for librarian subagent." }],
        details: { error: "no_model", configPath: subagentConfig.configPath },
        isError: true,
      };
    }

    const result = await runIsolatedSubagent({
      subagentName: "librarian",
      onUpdate: (partial) => {
        _onUpdate?.({
          content: partial.content,
          details: { query: params.query, transcript: partial.details },
        });
      },
      ctx,
      model,
      thinkingLevel: subagentConfig.thinkingLevel,
      systemPrompt: LIBRARIAN_SYSTEM_PROMPT,
      tools: [
        createReadTool("/tmp"),
        createGrepTool("/tmp"),
        createFindTool("/tmp"),
        createLsTool("/tmp"),
        githubRepoDiscoveryTool,
        githubCloneTool,
        researchWebSearchTool,
        researchCodeSearchTool,
      ],
      task: `Follow this deterministic repository protocol before answering:\n1. If the query names GitHub repos, call github_clone for each one and analyze the /tmp clone.\n2. If the query names only a package/library, call github_repo_discovery first; if it is ambiguous or missing, stop without guessing.\n3. If a version/ref is requested, pass that exact ref to github_clone and do not silently fall back to HEAD.\n4. In each clone inspect tests/ and examples/ before README/docs, and use docs only when code evidence is insufficient.\n5. For comparison questions: compare 2-3 repos by default, compare 4-5 only when user-provided, and split 6+ repos into batches.\n6. Rank comparison findings by API correctness, question fit, recency/current implementation, then documentation/example quality.\n7. In the final answer, cite code claims only with strict GitHub permalinks pinned to the github_clone commit: https://github.com/<owner>/<repo>/blob/<commit>/<path>#L<start>-L<end>.\n8. If evidence remains weak or ambiguous, state uncertainty and stop rather than guessing.\n\nUser query: ${params.query}`,
      signal,
      timeoutMs: 300_000,
    });

    return {
      content: [{ type: "text", text: result.finalText }],
      details: { query: params.query, transcript: result.details },
    };
  },
});
