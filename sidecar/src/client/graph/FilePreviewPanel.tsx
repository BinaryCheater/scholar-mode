import type { PointerEvent as ReactPointerEvent } from "react";
import { MarkdownContent } from "../MarkdownContent";
import { clamp, defaultPreviewSize, htmlWithWorkspaceBase, shortPath, type FilePreviewState, type PreviewDock } from "./graphUi";

export function FilePreviewPanel({
  dock,
  onClose,
  onDockChange,
  onOpenFile,
  onOpenPath,
  onResize,
  size,
  preview
}: {
  dock: PreviewDock;
  onClose: () => void;
  onDockChange: (dock: PreviewDock) => void;
  onOpenFile: (path: string) => void;
  onOpenPath: (path: string) => void;
  onResize: (size: { right: number; bottom: number }) => void;
  size: { right: number; bottom: number };
  preview: FilePreviewState;
}) {
  if (preview.status === "idle") return null;

  return (
    <aside className="file-preview-panel">
      <button className={`preview-resize-handle ${dock}`} onDoubleClick={() => onResize(defaultPreviewSize())} onPointerDown={(event) => startPreviewResize(event, dock, size, onResize)} title={dock === "right" ? "Drag to resize preview width" : "Drag to resize preview height"} />
      <header>
        <div>
          <strong>{preview.title}</strong>
          <span>{preview.path}</span>
        </div>
        <div className="file-preview-actions">
          <button className={dock === "right" ? "active" : ""} onClick={() => onDockChange("right")} title="Dock right">
            Right
          </button>
          <button className={dock === "bottom" ? "active" : ""} onClick={() => onDockChange("bottom")} title="Dock bottom">
            Bottom
          </button>
          {(preview.status === "ready" || preview.status === "loading") && <button onClick={() => onOpenFile(preview.path)}>Open file</button>}
          <button onClick={onClose} title="Close preview">
            ×
          </button>
        </div>
      </header>
      {preview.status === "loading" && <div className="file-preview-state">Loading file...</div>}
      {preview.status === "note" && (
        <div className="file-preview-state">
          {preview.summary || "This node is currently represented only in graph.yaml. Add file or files later when it needs longer notes."}
        </div>
      )}
      {preview.status === "error" && <div className="file-preview-state error">{preview.message}</div>}
      {preview.status === "ready" && (
        <>
          <div className="file-preview-meta">
            {preview.bytes.toLocaleString()} bytes · {preview.mimeType}
          </div>
          {preview.links.length > 1 && (
            <div className="file-preview-links" aria-label="Linked documents">
              {preview.links.map((link) => (
                <button key={link.path} className={link.path === preview.path ? "active" : ""} disabled={link.fileExists === false} onClick={() => onOpenPath(link.path)} title={link.path}>
                  {link.title || shortPath(link.path)}
                </button>
              ))}
            </div>
          )}
          <FilePreviewContent preview={preview} />
        </>
      )}
    </aside>
  );
}

function FilePreviewContent({ preview }: { preview: Extract<FilePreviewState, { status: "ready" }> }) {
  if (preview.format === "markdown") {
    return <MarkdownContent basePath={preview.path} className="file-preview-markdown" content={preview.content} />;
  }

  if (preview.format === "html") {
    return <iframe className="file-preview-html" sandbox="allow-same-origin" srcDoc={htmlWithWorkspaceBase(preview.path, preview.content)} title={preview.title} />;
  }

  return <pre>{preview.content}</pre>;
}

function startPreviewResize(
  event: ReactPointerEvent<HTMLButtonElement>,
  dock: PreviewDock,
  size: { right: number; bottom: number },
  onResize: (size: { right: number; bottom: number }) => void
) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  const startX = event.clientX;
  const startY = event.clientY;
  const start = { ...size };

  function onMove(moveEvent: PointerEvent) {
    if (dock === "right") {
      const next = clamp(start.right - (moveEvent.clientX - startX), 300, Math.max(360, window.innerWidth - 520));
      onResize({ ...start, right: next });
    } else {
      const next = clamp(start.bottom - (moveEvent.clientY - startY), 220, Math.max(260, window.innerHeight - 240));
      onResize({ ...start, bottom: next });
    }
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}
