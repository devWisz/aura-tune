/**
 * Thin localStorage wrapper.
 *
 * Storage throws in private-browsing and sandboxed contexts, so every access is
 * guarded and failures fall back to the supplied default rather than breaking
 * the studio.
 */
const PREFIX = "auratune:";

export function loadState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveState(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage blocked — settings simply will not persist */
  }
}

export function clearState(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Coalesces bursts of writes (e.g. dragging a fader) into one save. */
export function debounceSave(delayMs = 350) {
  const timers = new Map<string, number>();
  return (key: string, value: unknown) => {
    const existing = timers.get(key);
    if (existing) window.clearTimeout(existing);
    timers.set(
      key,
      window.setTimeout(() => {
        saveState(key, value);
        timers.delete(key);
      }, delayMs)
    );
  };
}
