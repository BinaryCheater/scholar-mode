import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

export function MarkdownContent({ basePath, className = "", content }: { basePath?: string; className?: string; content: string }) {
  return (
    <div className={className ? `markdown-body ${className}` : "markdown-body"}>
      <ReactMarkdown
        components={{
          a({ href, children, node: _node, ...props }) {
            const resolved = href && basePath ? workspaceDocumentUrl(resolveDocumentLink(basePath, href)) : null;
            return (
              <a href={resolved || href} {...props}>
                {children}
              </a>
            );
          },
          img({ src, node: _node, ...props }) {
            const resolved = src && basePath ? workspaceRawUrl(resolveDocumentLink(basePath, src)) : null;
            return <img src={resolved || src} {...props} />;
          }
        }}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function resolveDocumentLink(basePath: string, href: string) {
  const cleanHref = href.trim();
  if (!cleanHref || cleanHref.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(cleanHref) || cleanHref.startsWith("//")) {
    return null;
  }
  const suffixIndex = firstSuffixIndex(cleanHref);
  const pathPart = suffixIndex >= 0 ? cleanHref.slice(0, suffixIndex) : cleanHref;
  const suffix = suffixIndex >= 0 ? cleanHref.slice(suffixIndex) : "";
  if (!pathPart) return null;

  const baseParts = basePath.split("/").slice(0, -1);
  const parts = [...baseParts, ...pathPart.split("/")];
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!normalized.length) return null;
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.length ? `${normalized.join("/")}${suffix}` : null;
}

function workspaceDocumentUrl(path: string | null) {
  if (!path) return null;
  const [pathPart, suffix] = splitResolvedPath(path);
  return `/viewer?path=${encodeURIComponent(pathPart)}${suffix}`;
}

function workspaceRawUrl(path: string | null) {
  if (!path) return null;
  const [pathPart, suffix] = splitResolvedPath(path);
  const querySafeSuffix = suffix.startsWith("?") ? `&${suffix.slice(1)}` : suffix;
  return `/api/workspace/raw?path=${encodeURIComponent(pathPart)}${querySafeSuffix}`;
}

function firstSuffixIndex(value: string) {
  const hash = value.indexOf("#");
  const query = value.indexOf("?");
  const candidates = [hash, query].filter((index) => index >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

function splitResolvedPath(path: string): [string, string] {
  const suffixIndex = firstSuffixIndex(path);
  if (suffixIndex < 0) return [path, ""];
  return [path.slice(0, suffixIndex), path.slice(suffixIndex)];
}
