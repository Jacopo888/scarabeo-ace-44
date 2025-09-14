// Simple toast de-duplication with cooldown to avoid spammy repeats
// Keeps last-shown timestamps by key in module scope
const lastShown: Record<string, number> = {};

export type ToastFn = (opts: any) => void;

export function toastOnce(
  toast: ToastFn,
  key: string,
  description: string,
  opts?: { title?: string; variant?: string; cooldownMs?: number }
) {
  try {
    const now = Date.now();
    const cooldown = opts?.cooldownMs ?? 5000; // default 5s
    const last = lastShown[key] || 0;
    if (now - last < cooldown) return;
    lastShown[key] = now;
    toast({
      title: opts?.title ?? 'Notice',
      description,
      variant: opts?.variant ?? 'default',
    });
  } catch {
    // no-op if toast subsystem not available
  }
}

export default toastOnce;

