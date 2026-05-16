import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "../src/client/MarkdownContent";

describe("MarkdownContent", () => {
  it("renders inline and block LaTeX through KaTeX", () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, { content: "Inline $x_i + y_i$.\n\n$$\n\\sum_i x_i\n$$" }));

    expect(html).toContain("katex");
    expect(html).toContain("katex-display");
    expect(html).not.toContain("$x_i + y_i$");
  });

  it("keeps fenced code blocks as readable pre/code markup", () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, { content: "```bash\npython3 -m demo \\\\\n  --flag value\n```" }));

    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("python3 -m demo");
    expect(html).toContain("--flag value");
  });

  it("routes local markdown links to the standalone viewer", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, {
        basePath: "research/notes/main.md",
        content: "[Related](./related.md#claim)"
      })
    );

    expect(html).toContain('href="/viewer?path=research%2Fnotes%2Frelated.md#claim"');
  });

  it("routes local images to raw workspace files without folding suffixes into the file path", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, {
        basePath: "research/notes/main.md",
        content: "![Diagram](./assets/figure.png?cache=1#v2)"
      })
    );

    expect(html).toContain('src="/api/workspace/raw?path=research%2Fnotes%2Fassets%2Ffigure.png&amp;cache=1#v2"');
    expect(html).not.toContain("figure.png%3Fcache");
  });
});
