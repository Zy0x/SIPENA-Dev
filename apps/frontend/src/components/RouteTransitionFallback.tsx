import { useEffect, useState } from "react";

export function RouteTransitionFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="sipena-route-progress fixed inset-x-0 top-0 z-[190] h-0.5 overflow-hidden bg-primary/15 pointer-events-none"
      role="progressbar"
      aria-label="Menyiapkan halaman berikutnya"
    >
      <span className="block h-full w-1/3 bg-primary" />
    </div>
  );
}
