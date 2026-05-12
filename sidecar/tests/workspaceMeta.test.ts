import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findInstructionFiles,
  loadSkillByReference,
  loadTriggeredSkillFiles,
  scanWorkspaceSkills,
  selectSkillTriggers,
  selectTriggeredSkills
} from "../src/lib/workspaceMeta";

describe("workspace metadata", () => {
  it("finds CLAUDE/AGENTS instruction files", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "CLAUDE.md"), "Claude instructions");
    await writeFile(join(root, "AGENTS.md"), "Agent instructions");

    const files = await findInstructionFiles(root);

    expect(files.map((file) => file.path)).toEqual(["AGENTS.md", "CLAUDE.md"]);
  });

  it("scans skill frontmatter and selects triggered skills", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(join(root, "research-skill"), { recursive: true });
    await writeFile(
      join(root, "research-skill", "SKILL.md"),
      "---\nname: research-review\ndescription: Use for research critique and evidence review.\n---\n# Research Review"
    );

    const skills = await scanWorkspaceSkills(root);
    const triggered = selectTriggeredSkills(skills, "Please critique this research evidence.");

    expect(skills[0].name).toBe("research-review");
    expect(triggered[0].name).toBe("research-review");
    expect(selectTriggeredSkills(skills, "Use research review here")[0].name).toBe("research-review");
  });

  it("classifies skill matches for progressive disclosure", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(join(root, "research-skill"), { recursive: true });
    await writeFile(
      join(root, "research-skill", "SKILL.md"),
      "---\nname: research-review\ndescription: Use for research critique and evidence review.\n---\n# Research Review"
    );

    const skills = await scanWorkspaceSkills(root);
    const explicit = selectSkillTriggers(skills, "Use research-review for this.");
    const semantic = selectSkillTriggers(skills, "Please critique this research evidence.");

    expect(explicit[0]).toMatchObject({ confidence: "high", disclosure: "loaded" });
    expect(semantic[0]).toMatchObject({ confidence: "high", disclosure: "loaded" });
    expect(selectSkillTriggers(skills, "please use this skill")).toEqual([]);
    await expect(loadTriggeredSkillFiles(root, explicit)).resolves.toHaveLength(1);
  });

  it("loads a skill by name or path", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(join(root, "research-skill"), { recursive: true });
    await writeFile(
      join(root, "research-skill", "SKILL.md"),
      "---\nname: research-review\ndescription: Use for research critique.\n---\n# Research Review"
    );

    await expect(loadSkillByReference(root, "research-review")).resolves.toMatchObject({
      path: "research-skill/SKILL.md",
      content: expect.stringContaining("# Research Review")
    });
    await expect(loadSkillByReference(root, "research-skill/SKILL.md")).resolves.toMatchObject({
      path: "research-skill/SKILL.md"
    });
  });
});
