import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
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

function execFileAsync(file: string, args: string[], options: { signal?: AbortSignal; timeout: number; maxBuffer?: number }) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

const githubDiscoverySchema = Type.Object({
  query: Type.String({ description: "Package, library, or repo name to resolve to a canonical GitHub upstream" }),
  maxCandidates: Type.Optional(Type.Integer({ minimum: 2, maximum: 10, description: "Candidate count to inspect (default: 5)" })),
});

type GithubDiscoveryInput = Static<typeof githubDiscoverySchema>;

const githubCloneSchema = Type.Object({
  repo: Type.String({ description: "GitHub repo as owner/name, https://github.com/owner/name, https://github.com/owner/name/tree/ref, or git@github.com:owner/name.git" }),
  ref: Type.Optional(Type.String({ description: "Requested branch, tag, or commit. If supplied, checkout must succeed. Overrides refs embedded in GitHub URLs." })),
});

type GithubCloneInput = Static<typeof githubCloneSchema>;
type NormalizedGithubRepoInput = { repo: string; ref?: string };

type GithubSearchItem = {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  fork?: boolean;
  archived?: boolean;
};

function decodeGithubPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractGithubUrlRef(rest?: string): string | undefined {
  const parts = rest?.split("/").filter(Boolean) ?? [];
  const kind = parts[0]?.toLowerCase();
  if (kind === "tree" && parts.length > 1) return decodeGithubPath(parts.slice(1).join("/"));
  if (kind === "commit" && parts[1]) return decodeGithubPath(parts[1]);
  if (kind === "releases" && parts[1]?.toLowerCase() === "tag" && parts.length > 2) return decodeGithubPath(parts.slice(2).join("/"));
  return undefined;
}

function normalizeGithubRepoInput(repo: string): NormalizedGithubRepoInput | null {
  const trimmed = repo.trim();
  const urlMatch = trimmed.match(/^(?:https?:\/\/)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/([^#?\s]*))?(?:[?#].*)?$/i);
  const sshMatch = trimmed.match(/^git@github\.com:([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[#?\s].*)?$/i);
  const shorthandMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  const match = urlMatch ?? sshMatch ?? shorthandMatch;
  if (!match) return null;
  const owner = match[1];
  const name = match[2].replace(/\.git$/i, "");
  if (!owner || !name) return null;
  return { repo: `${owner}/${name}`, ref: urlMatch ? extractGithubUrlRef(urlMatch[3]) : undefined };
}

function normalizeGithubRepo(repo: string): string | null {
  return normalizeGithubRepoInput(repo)?.repo ?? null;
}

function cloneDirName(repo: string, ref?: string): string {
  return `librarian-${repo.replace(/[^A-Za-z0-9_.-]+/g, "-")}${ref ? `-${ref.replace(/[^A-Za-z0-9_.-]+/g, "-")}` : ""}-`;
}

async function checkoutRequestedGithubRef(dir: string, ref: string, signal?: AbortSignal) {
  await execFileAsync("git", ["-C", dir, "fetch", "--depth", "1", "origin", ref], { signal, timeout: 120_000, maxBuffer: 1024 * 1024 });
  await execFileAsync("git", ["-C", dir, "checkout", "--detach", "FETCH_HEAD"], { signal, timeout: 120_000, maxBuffer: 1024 * 1024 });
}

async function cloneGithubRepo(repoInput: string, requestedRef: string | undefined, signal?: AbortSignal) {
  const normalized = normalizeGithubRepoInput(repoInput);
  if (!normalized) throw new Error("repo must be a GitHub owner/name or github.com URL");
  const repo = normalized.repo;
  const ref = requestedRef ?? normalized.ref;
  const dir = await mkdtemp(join(tmpdir(), cloneDirName(repo, ref)));
  const url = `https://github.com/${repo}.git`;
  try {
    const cloneArgs = ["clone", "--depth", "1"];
    if (ref) cloneArgs.push("--no-checkout");
    cloneArgs.push(url, dir);
    await execFileAsync("git", cloneArgs, { signal, timeout: 120_000, maxBuffer: 1024 * 1024 });
    if (ref) await checkoutRequestedGithubRef(dir, ref, signal);
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

function scopedPackageParts(query: string) {
  const match = query.trim().toLowerCase().match(/^@([^/\s]+)\/([^/\s]+)$/);
  if (!match) return null;
  return { scope: match[1], packageName: match[2] };
}

function matchesCanonicalIdentifier(query: string, fullNameInput: string) {
  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "");
  const fullName = fullNameInput.toLowerCase();
  const [owner, name = fullName] = fullName.split("/");
  const scoped = scopedPackageParts(query);

  if (scoped) {
    if (fullName === normalizedQuery) return true;
    if (owner !== scoped.scope) return false;
    return name === scoped.packageName || name === `${scoped.scope}-${scoped.packageName}` || name.endsWith(`-${scoped.packageName}`);
  }

  const queryName = normalizedQuery.split("/").at(-1) ?? normalizedQuery;
  return fullName === normalizedQuery || name === normalizedQuery || name === queryName;
}

function chooseCanonicalGithubRepo(query: string, items: GithubSearchItem[]) {
  const candidates = items.filter(item => item.full_name && item.html_url && !item.fork && !item.archived);
  if (candidates.length === 0) return { status: "not_found" as const, candidates };

  const exact = candidates.filter(item => matchesCanonicalIdentifier(query, item.full_name!));
  if (exact.length === 1) return { status: "found" as const, repo: exact[0], candidates };
  if (exact.length > 1) return { status: "ambiguous" as const, candidates: exact };

  return { status: "ambiguous" as const, candidates };
}

export const githubRepoDiscoveryTool = defineTool({
  name: "github_repo_discovery",
  label: "GitHub Repo Discovery",
  description: "Resolve a package/library name to a canonical GitHub upstream; fails closed on ambiguity.",
  promptSnippet: "Resolve package-only names to canonical GitHub repos; stop on ambiguity.",
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
      if (decision.status === "not_found") {
        return {
          content: [{ type: "text", text: `No canonical GitHub upstream found for '${query}'. Candidates inspected: None. Fall back to official documentation or other authoritative non-code sources; do not invent code evidence.` }],
          details: { status: "not_found", candidates },
        };
      }
      return {
        content: [{ type: "text", text: `Ambiguous GitHub upstream for '${query}'. Do not guess. Candidates inspected:\n- ${candidates.join("\n- ") || "None"}` }],
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
  promptSnippet: "Clone named/discovered GitHub repos into /tmp before local analysis.",
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

function createTrackedGithubCloneTool(clonedPaths: Set<string>) {
  return {
    ...githubCloneTool,
    async execute(toolCallId: string, params: GithubCloneInput, signal?: AbortSignal) {
      const result = await githubCloneTool.execute(toolCallId, params, signal, undefined, undefined as any);
      const resultDetails = result as { details?: { path?: unknown }; isError?: boolean };
      const path = resultDetails.details?.path;
      if (!resultDetails.isError && typeof path === "string") clonedPaths.add(path);
      return result;
    },
  };
}

async function cleanupLibrarianClonePaths(clonedPaths: Set<string>) {
  await Promise.all([...clonedPaths].map(path => rm(path, { recursive: true, force: true }).catch(() => undefined)));
}

export const LIBRARIAN_SYSTEM_PROMPT = `You are Librarian, a read-only OSS research specialist.
Answer library/framework/SDK questions with upstream evidence, not guesses. Do not modify the user repo; clone public repos only into /tmp. Final code claims must use strict GitHub permalinks pinned to the cloned commit, never branch or local-only paths.

Tools: Use github_repo_discovery first for package-only names; stop on ambiguity. Clone every named/discovered GitHub repo before local analysis; for user-specified refs, pass that ref to github_clone and stop if checkout fails. Use web_search/code_search for docs, release notes, examples, and secondary validation.

Evidence: source/tests/examples before docs; source wins conflicts. Cite every code claim as https://github.com/<owner>/<repo>/blob/<commit>/<path>#L<start>-L<end>. If decisive source/code evidence remains weak, ambiguous, or missing, say so and stop.
Comparisons: default 2-3 repos. Compare 4-5 only when the user explicitly provides them; split 6+ into batches. Rank findings in this order: API correctness, closest fit to the user's question, recency/current implementation, then documentation/example quality.

${LEAN_RESPONSE_INSTRUCTIONS}

Final format:
Summary: one sentence.
Evidence: commit-pinned GitHub permalink or official URL — quote/snippet + decisive detail.
Findings: concise bullets/table suited to question.
Uncertainty: weak/ambiguous evidence, or None.
Next: one follow-up, or None.`;

export const librarianTool = defineTool({
  name: "librarian",
  label: "Librarian",
  description: "Launch a read-only research subagent for evidence-backed open-source library and upstream repository analysis.",
  promptSnippet: "Use librarian for OSS/library research with source evidence and GitHub permalinks.",
  promptGuidelines: [
    "Use librarian for external libraries, SDKs, frameworks, and upstream repos.",
    "Librarian prioritizes tests/examples/source over docs and cites permalinks.",
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

    const clonedPaths = new Set<string>();
    try {
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
          createTrackedGithubCloneTool(clonedPaths),
          researchWebSearchTool,
          researchCodeSearchTool,
        ],
        task: `Follow this deterministic repository protocol before answering:\n1. If the query names GitHub repos, call github_clone for each one and analyze the /tmp clone.\n2. If the query names only a package/library, call github_repo_discovery first; if it is ambiguous, stop without guessing; if it is missing, fall back to official docs or other authoritative non-code sources and state that source-code evidence was unavailable.\n3. If a version/ref is requested, pass that exact ref to github_clone and do not silently fall back to HEAD.\n4. In each clone inspect tests/ and examples/ before README/docs, and use docs only when code evidence is insufficient.\n5. For comparison questions: compare 2-3 repos by default, compare 4-5 only when user-provided, and split 6+ repos into batches.\n6. Rank comparison findings by API correctness, question fit, recency/current implementation, then documentation/example quality.\n7. In the final answer, cite code claims only with strict GitHub permalinks pinned to the github_clone commit: https://github.com/<owner>/<repo>/blob/<commit>/<path>#L<start>-L<end>.\n8. If evidence remains weak or ambiguous, state uncertainty and stop rather than guessing.\n\nUser query: ${params.query}`,
        signal,
        timeoutMs: 300_000,
      });

      return {
        content: [{ type: "text", text: result.finalText }],
        details: { query: params.query, transcript: result.details },
      };
    } finally {
      await cleanupLibrarianClonePaths(clonedPaths);
    }
  },
});
