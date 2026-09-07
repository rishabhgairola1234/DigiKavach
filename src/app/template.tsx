// Next.js remounts `template.tsx` on every navigation (unlike layout.tsx,
// which persists) -- that remount is what re-triggers the `page-transition`
// CSS animation on each route change. Applies to every page automatically,
// including ones added later, with no per-page work required.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
