import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to top on route change, or to a hash target if present.
 * Placed inside LayoutRoute to handle all protected route navigations.
 */
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (hash) {
      // Scroll to hash target after a small delay for DOM readiness
      const timer = setTimeout(() => {
        const id = hash.replace("#", "");
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      // No hash — scroll to top
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [pathname, hash, key]);

  return null;
}
