import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { readWorkspaceFile } from "./files.js";
import type { FileSnapshot, WorkspaceSkill, WorkspaceSkillTrigger } from "./types.js";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "dist-server", "data", ".tmp-tests"]);
const INSTRUCTION_RE = /^(CLAUDE|AGENTS)\.md$/i;
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "use",
  "using",
  "when",
  "task",
  "asks",
  "user",
  "mode",
  "skill",
  "review",
  "analysis",
  "context"
]);

export async function findInstructionFiles(workspaceRoot: string): Promise<FileSnapshot[]> {
  const files = await listFiles(workspaceRoot, 3);
  const matches = files.filter((file) => INSTRUCTION_RE.test(file.split("/").pop() || "")).sort();
  const snapshots = await Promise.all(matches.map((path) => readWorkspaceFile(workspaceRoot, path)));
  return snapshots;
}

export async function scanWorkspaceSkills(workspaceRoot: string): Promise<WorkspaceSkill[]> {
  const files = await listFiles(workspaceRoot, 5);
  const skillFiles = files.filter((file) => file.endsWith("SKILL.md")).sort();
  const skillsByName = new Map<string, WorkspaceSkill>();
  for (const path of skillFiles) {
    const content = await readFile(join(workspaceRoot, path), "utf8");
    const meta = parseSkillFrontmatter(content);
    if (meta.name) {
      const skill = {
        name: meta.name,
        description: meta.description || "",
        path
      };
      const key = meta.name.toLowerCase();
      const existing = skillsByName.get(key);
      if (!existing || skillPriority(skill.path) > skillPriority(existing.path)) {
        skillsByName.set(key, skill);
      }
    }
  }
  return [...skillsByName.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function selectTriggeredSkills(skills: WorkspaceSkill[], text: string) {
  return selectSkillTriggers(skills, text).map((trigger) => trigger.skill);
}

export function selectSkillTriggers(skills: WorkspaceSkill[], text: string): WorkspaceSkillTrigger[] {
  const query = tokenize(text);
  const rawText = text.toLowerCase();
  if (!query.size && !rawText.trim()) return [];
  return skills
    .map((skill) => ({ skill, score: scoreSkill(skill, query, rawText) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ skill, score }) => {
      const confidence = score >= 3 ? "high" : "medium";
      return {
        skill,
        score,
        confidence,
        reason: triggerReason(skill, score, text),
        disclosure: confidence === "high" ? "loaded" : "candidate"
      };
    });
}

export async function loadTriggeredSkillFiles(workspaceRoot: string, triggers: WorkspaceSkillTrigger[]): Promise<FileSnapshot[]> {
  const loaded = triggers.filter((trigger) => trigger.disclosure === "loaded").slice(0, 3);
  return Promise.all(loaded.map((trigger) => readWorkspaceFile(workspaceRoot, trigger.skill.path)));
}

export async function loadSkillByReference(workspaceRoot: string, reference: string): Promise<FileSnapshot> {
  const normalized = reference.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Skill name or path is required.");
  }

  const skills = await scanWorkspaceSkills(workspaceRoot);
  const match = skills.find(
    (skill) =>
      skill.name.toLowerCase() === normalized ||
      skill.path.toLowerCase() === normalized ||
      skill.path.toLowerCase().endsWith(`/${normalized}`)
  );
  if (!match) {
    throw new Error(`Skill not found: ${reference}`);
  }
  return readWorkspaceFile(workspaceRoot, match.path);
}

async function listFiles(root: string, maxDepth: number, dir = "", depth = 0): Promise<string[]> {
  if (depth > maxDepth) return [];
  let entries;
  try {
    entries = await readdir(join(root, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".agents") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...(await listFiles(root, maxDepth, rel, depth + 1)));
    } else if (entry.isFile()) {
      const info = await stat(join(root, rel));
      if (info.size <= 512_000) results.push(relative(root, join(root, rel)));
    }
  }
  return results;
}

function parseSkillFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  const raw = match?.[1] || "";
  return {
    name: raw.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim(),
    description: raw.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m)?.[1]?.trim()
  };
}

function skillPriority(path: string) {
  if (/^skills\/[^/]+\/SKILL\.md$/i.test(path)) return 3;
  if (/^\.agents\/skills\/[^/]+\/SKILL\.md$/i.test(path)) return 2;
  return 1;
}

function scoreSkill(skill: WorkspaceSkill, query: Set<string>, rawText: string) {
  const normalizedName = skill.name.toLowerCase();
  const spacedName = normalizedName.replace(/[-_]+/g, " ");
  const haystack = tokenize(`${skill.name} ${spacedName} ${skill.description}`);
  let score = 0;
  for (const token of query) {
    if (haystack.has(token)) score += 1;
  }
  if (rawText.includes(normalizedName) || rawText.includes(spacedName)) score += 6;
  return score;
}

function triggerReason(skill: WorkspaceSkill, score: number, text: string) {
  const rawText = text.toLowerCase();
  const normalizedName = skill.name.toLowerCase();
  const spacedName = normalizedName.replace(/[-_]+/g, " ");
  if (rawText.includes(normalizedName) || rawText.includes(spacedName)) {
    return `Prompt explicitly mentions ${skill.name}.`;
  }
  const query = tokenize(text);
  const haystack = tokenize(`${skill.name} ${spacedName} ${skill.description}`);
  const matches = [...query].filter((token) => haystack.has(token)).slice(0, 5);
  return matches.length
    ? `Matched skill description terms: ${matches.join(", ")}. Score ${score}.`
    : `Matched skill routing score ${score}.`;
}

function tokenize(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_\-\u4e00-\u9fff]+/u)
      .filter((token) => (token.length > 2 || ["ai", "cv", "ml", "rl"].includes(token)) && !STOPWORDS.has(token))
  );
}
