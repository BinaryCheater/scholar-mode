import { describe, expect, it } from "vitest";
import { groupToolMessages, type ToolMessageLike } from "../src/client/toolMessages";

function message(input: Partial<ToolMessageLike> & Pick<ToolMessageLike, "id" | "role" | "content">): ToolMessageLike {
  return input;
}

describe("tool message grouping", () => {
  it("pairs adjacent tool calls and results inside one collapsed run", () => {
    const grouped = groupToolMessages([
      message({ id: "u1", role: "user", content: "review this" }),
      message({ id: "t1", role: "tool", toolName: "read_workspace_file", content: "Calling `read_workspace_file` with:\n{}" }),
      message({ id: "t2", role: "tool", toolName: "read_workspace_file", content: "Result from `read_workspace_file`:\nbody" }),
      message({ id: "t3", role: "tool", toolName: "get_git_diff", content: "Calling `get_git_diff` with:\n{}" }),
      message({ id: "t4", role: "tool", toolName: "get_git_diff", content: "Result from `get_git_diff`:\ndiff" }),
      message({ id: "a1", role: "assistant", content: "done" })
    ]);

    expect(grouped).toHaveLength(3);
    expect(grouped[1]).toMatchObject({
      kind: "tool-run",
      run: {
        exchanges: [
          { name: "read_workspace_file", call: { id: "t1" }, result: { id: "t2" } },
          { name: "get_git_diff", call: { id: "t3" }, result: { id: "t4" } }
        ]
      }
    });
  });

  it("keeps separated tool runs apart", () => {
    const grouped = groupToolMessages([
      message({ id: "t1", role: "tool", toolName: "first", content: "Calling `first` with:\n{}" }),
      message({ id: "a1", role: "assistant", content: "intermediate" }),
      message({ id: "t2", role: "tool", toolName: "second", content: "Calling `second` with:\n{}" })
    ]);

    expect(grouped.map((item) => item.kind)).toEqual(["tool-run", "message", "tool-run"]);
  });
});
