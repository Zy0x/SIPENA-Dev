import { Outlet } from "react-router-dom";
import AppLayout from "./AppLayout";
import { ScrollToTop } from "./ScrollToTop";

/**
 * Layout route wrapper — renders AppLayout once,
 * persisting sidebar across page navigations via <Outlet />.
 * ScrollToTop ensures proper scroll position on navigation.
 */
export default function LayoutRoute() {
  return (
    <AppLayout>
      <ScrollToTop />
      <Outlet />
    </AppLayout>
  );
}
