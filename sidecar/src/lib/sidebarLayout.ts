export const DEFAULT_SIDEBAR_WIDTH = 328;
export const MIN_SIDEBAR_WIDTH = 248;
export const MAX_SIDEBAR_WIDTH = 560;
export const DEFAULT_SIDEBAR_SPLIT = 50;
export const MIN_SIDEBAR_SPLIT = 24;
export const MAX_SIDEBAR_SPLIT = 76;

export function clampSidebarWidth(width: number | undefined, viewportWidth: number) {
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH;
  const viewportMax = Math.max(MIN_SIDEBAR_WIDTH, Math.floor(viewportWidth * 0.48));
  return Math.min(Math.max(width as number, MIN_SIDEBAR_WIDTH), Math.min(MAX_SIDEBAR_WIDTH, viewportMax));
}

export function clampSidebarSplit(split: number | undefined) {
  if (!Number.isFinite(split)) return DEFAULT_SIDEBAR_SPLIT;
  return Math.min(Math.max(split as number, MIN_SIDEBAR_SPLIT), MAX_SIDEBAR_SPLIT);
}
