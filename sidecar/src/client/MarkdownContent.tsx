import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ basePath, className = "", content }: { basePath?: string; className?: string; content: string }) {
  return (
    <div className={className ? `markdown-body ${className}` : "markdown-body"}>
      <ReactMarkdown
        components={{
          a({ href, children, ...props }) {
            const resolved = href && basePath ? rawWorkspaceUrl(resolveDocumentLink(basePath, href)) : null;
            return (
              <a href={resolved || href} {...props}>
                {children}
              </a>
            );
          },
          img({ src, ...props }) {
            const resolved = src && basePath ? rawWorkspaceUrl(resolveDocumentLink(basePath, src)) : null;
            return <img src={resolved || src} {...props} />;
          }
        }}
        remarkPlugins={[remarkGfm]}
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

function rawWorkspaceUrl(path: string | null) {
  return path ? `/api/workspace/raw?path=${encodeURIComponent(path)}` : null;
}

function firstSuffixIndex(value: string) {
  const hash = value.indexOf("#");
  const query = value.indexOf("?");
  const candidates = [hash, query].filter((index) => index >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}
