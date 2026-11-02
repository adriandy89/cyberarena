/**
 * Re-mounts on every navigation, so each page enters with a short fade/slide
 * (spec 010 T009). The animation uses `backwards` fill so no transform stays
 * applied afterwards (a lingering transform would trap position:fixed children).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
