import { useEffect, useState } from "react";
import { api, errorText, type FileSnapshot } from "../api";
import { MarkdownContent } from "../MarkdownContent";

export function StandaloneFileViewer() {
  const [snapshot, setSnapshot] = useState<FileSnapshot | null>(null);
  const [error, setError] = useState("");
  const path = new URLSearchParams(window.location.search).get("path") || "";

  useEffect(() => {
    if (!path) {
      setError("Missing workspace file path.");
      return;
    }
    void api<FileSnapshot>(`/api/workspace/file?path=${encodeURIComponent(path)}`)
      .then((result) => {
        document.title = result.path;
        setSnapshot(result);
      })
      .catch((err) => setError(errorText(err)));
  }, [path]);

  return (
    <main className="standalone-viewer">
      <header>
        <div>
          <strong>{snapshot?.path || path || "Workspace document"}</strong>
          {snapshot && (
            <span>
              {snapshot.bytes.toLocaleString()} bytes · {snapshot.mimeType}
            </span>
          )}
        </div>
        {snapshot && (
          <a href={`/api/workspace/raw?path=${encodeURIComponent(snapshot.path)}`} target="_blank" rel="noreferrer">
            Raw
          </a>
        )}
      </header>
      {error && <div className="standalone-state error">{error}</div>}
      {!error && !snapshot && <div className="standalone-state">Loading file...</div>}
      {snapshot?.format === "markdown" && <MarkdownContent basePath={snapshot.path} className="standalone-markdown" content={snapshot.content} />}
      {snapshot?.format === "html" && <iframe className="standalone-html" sandbox="allow-same-origin" src={`/api/workspace/raw?path=${encodeURIComponent(snapshot.path)}`} title={snapshot.path} />}
      {snapshot?.format === "text" && <pre className="standalone-text">{snapshot.content}</pre>}
    </main>
  );
}
