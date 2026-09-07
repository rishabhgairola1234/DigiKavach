export function formatRelativeTime(dateIso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateIso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}
