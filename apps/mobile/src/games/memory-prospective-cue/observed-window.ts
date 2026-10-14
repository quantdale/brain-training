/** A display-owned window. Callbacks notice elapsed time; they never create it. */
export interface ObservedWindow {
  readonly sessionId: string | null;
  readonly roundIndex: number;
  readonly itemIndex: number;
  readonly phase: string;
  elapsedMs: number;
  startedAtMs: number | null;
}

export function readWindowElapsed(window: ObservedWindow, nowMs: number): number {
  return window.elapsedMs + (window.startedAtMs === null ? 0 : Math.max(0, nowMs - window.startedAtMs));
}

/** Pause/tutorial/transition claims stop exposure before a delayed UI commit. */
export function freezeWindow(window: ObservedWindow | null, nowMs: number): void {
  if (window === null || window.startedAtMs === null) return;
  window.elapsedMs = readWindowElapsed(window, nowMs);
  window.startedAtMs = null;
}
