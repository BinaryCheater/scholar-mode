import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, clampSidebarSplit, clampSidebarWidth } from "../../lib/sidebarLayout";

export const SIDEBAR_WIDTH_KEY = "thinking-sidecar-sidebar-width";
export const SIDEBAR_SPLIT_KEY = "thinking-sidecar-sidebar-split-v2";

export function SidebarResizeHandle({ collapsed, onResize, value }: { collapsed: boolean; onResize: (width: number) => void; value: number }) {
  if (collapsed) return null;

  function resizeTo(width: number) {
    onResize(clampSidebarWidth(width, window.innerWidth));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    document.body.classList.add("sidebar-resizing");

    function handlePointerMove(moveEvent: PointerEvent) {
      resizeTo(moveEvent.clientX);
    }

    function handlePointerUp() {
      document.body.classList.remove("sidebar-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      resizeTo(value - (event.shiftKey ? 40 : 12));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      resizeTo(value + (event.shiftKey ? 40 : 12));
    }
  }

  return (
    <div
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuenow={value}
      className="sidebar-resize-handle"
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
      title="Resize sidebar"
    />
  );
}

export function SidebarSectionResizeHandle({ containerRef, onResize, value }: { containerRef: RefObject<HTMLDivElement | null>; onResize: (split: number) => void; value: number }) {
  function resizeTo(clientY: number) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.height <= 0) return;
    onResize(clampSidebarSplit(((clientY - rect.top) / rect.height) * 100));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    document.body.classList.add("sidebar-split-resizing");

    function handlePointerMove(moveEvent: PointerEvent) {
      resizeTo(moveEvent.clientY);
    }

    function handlePointerUp() {
      document.body.classList.remove("sidebar-split-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onResize(clampSidebarSplit(value - (event.shiftKey ? 10 : 4)));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onResize(clampSidebarSplit(value + (event.shiftKey ? 10 : 4)));
    }
  }

  return (
    <div
      aria-label="Resize session and settings areas"
      aria-orientation="horizontal"
      aria-valuemax={76}
      aria-valuemin={24}
      aria-valuenow={value}
      className="sidebar-section-resize-handle"
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
      title="Resize session and settings areas"
    />
  );
}

export function readStoredSidebarWidth() {
  const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  return clampSidebarWidth(stored === null ? undefined : Number(stored), window.innerWidth);
}

export function readStoredSidebarSplit() {
  const stored = localStorage.getItem(SIDEBAR_SPLIT_KEY);
  return clampSidebarSplit(stored === null ? undefined : Number(stored));
}
