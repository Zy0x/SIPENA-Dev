import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const routeModules = {
  index: () => import("../pages/Index"),
  auth: () => import("../pages/Auth"),
  dashboard: () => import("../pages/Dashboard"),
  classes: () => import("../pages/Classes"),
  subjects: () => import("../pages/Subjects"),
  grades: () => import("../pages/Grades"),
  reports: () => import("../pages/Reports"),
  gradeReports: () => import("../pages/GradeReports"),
  rankings: () => import("../pages/StudentRankings"),
  settings: () => import("../pages/Settings"),
  profile: () => import("../pages/Profile"),
  help: () => import("../pages/Help"),
  about: () => import("../pages/About"),
  notFound: () => import("../pages/NotFound"),
  guestAccess: () => import("../pages/GuestAccess"),
  admin: () => import("../pages/Admin"),
  changelog: () => import("../pages/Changelog"),
  parentPortal: () => import("../pages/ParentPortal"),
  portalView: () => import("../pages/PortalView"),
  morphe: () => import("../pages/MorpheChat"),
  terms: () => import("../pages/Terms"),
  attendanceRuntime: () => import("@/features/attendance/runtime/AttendanceRuntimeRoute"),
  attendanceStable: () => import("@/features/attendance/stable/AttendanceStableRoute"),
} as const;

export type RouteModuleKey = keyof typeof routeModules;

const routeModulePromises = new Map<RouteModuleKey, Promise<unknown>>();
const ROUTE_RECOVERY_KEY = "sipena_route_chunk_recovery_v1";

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|loading chunk|chunkloaderror|module script/i.test(message);
}

export async function loadRouteWithRecovery<T>(
  key: RouteModuleKey,
  importer: () => Promise<T>,
): Promise<T> {
  try {
    const module = await importer();
    sessionStorage.removeItem(ROUTE_RECOVERY_KEY);
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has("__sipena_route_recovery")) {
      currentUrl.searchParams.delete("__sipena_route_recovery");
      window.history.replaceState(
        window.history.state,
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }
    return module;
  } catch (error) {
    if (!isChunkLoadError(error)) throw error;

    const recoveryId = `${__APP_BUILD_VERSION__}:${key}`;
    if (sessionStorage.getItem(ROUTE_RECOVERY_KEY) === recoveryId) {
      sessionStorage.removeItem(ROUTE_RECOVERY_KEY);
      throw error;
    }

    sessionStorage.setItem(ROUTE_RECOVERY_KEY, recoveryId);
    const recoveryUrl = new URL(window.location.href);
    recoveryUrl.searchParams.set("__sipena_route_recovery", __APP_BUILD_VERSION__);
    window.location.replace(recoveryUrl.toString());
    return new Promise<T>(() => undefined);
  }
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

export function resolveRouteModuleKey(pathname: string): RouteModuleKey | null {
  const path = normalizePathname(pathname);
  if (path.startsWith("/portal/")) return "portalView";

  const routes: Record<string, RouteModuleKey> = {
    "/": "index",
    "/auth": "auth",
    "/dashboard": "dashboard",
    "/classes": "classes",
    "/subjects": "subjects",
    "/grades": "grades",
    "/attendance": "attendanceStable",
    "/attendance-v2": "attendanceRuntime",
    "/reports": "reports",
    "/reports/grades": "gradeReports",
    "/reports/rankings": "rankings",
    "/reports/portal": "parentPortal",
    "/settings": "settings",
    "/settings/profile": "profile",
    "/help": "help",
    "/about": "about",
    "/share": "guestAccess",
    "/guest/grades": "grades",
    "/admin": "admin",
    "/changelog": "changelog",
    "/morphe": "morphe",
    "/terms": "terms",
  };

  return routes[path] ?? null;
}

export function preloadRoute(pathname: string): Promise<unknown> | null {
  const key = resolveRouteModuleKey(pathname);
  if (!key) return null;

  const existing = routeModulePromises.get(key);
  if (existing) return existing;

  const promise = routeModules[key]().catch(() => {
    routeModulePromises.delete(key);
    return null;
  });
  routeModulePromises.set(key, promise);
  return promise;
}

function allowsSpeculativePreload(): boolean {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;

  if (connection?.saveData) return false;
  return connection?.effectiveType !== "slow-2g" && connection?.effectiveType !== "2g";
}

function anchorPathFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;

  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin ? url.pathname : null;
}

function installIntentListeners(): () => void {
  const handleIntent = (event: Event) => {
    if (event.type === "pointerover" && !allowsSpeculativePreload()) return;
    const pathname = anchorPathFromTarget(event.target);
    if (pathname) void preloadRoute(pathname);
  };

  document.addEventListener("pointerover", handleIntent, { capture: true, passive: true });
  document.addEventListener("pointerdown", handleIntent, { capture: true, passive: true });
  document.addEventListener("focusin", handleIntent, true);

  return () => {
    document.removeEventListener("pointerover", handleIntent, true);
    document.removeEventListener("pointerdown", handleIntent, true);
    document.removeEventListener("focusin", handleIntent, true);
  };
}

const likelyNextRoute: Partial<Record<RouteModuleKey, string>> = {
  dashboard: "/classes",
  classes: "/subjects",
  subjects: "/grades",
  grades: "/reports/grades",
  reports: "/reports/grades",
  gradeReports: "/reports/rankings",
  settings: "/settings/profile",
  profile: "/settings",
};

function scheduleLikelyRoute(pathname: string): () => void {
  if (!allowsSpeculativePreload()) return () => undefined;
  const currentKey = resolveRouteModuleKey(pathname);
  const nextPath = currentKey ? likelyNextRoute[currentKey] : null;
  if (!nextPath) return () => undefined;

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const idleHandle = idleWindow.requestIdleCallback?.(() => { void preloadRoute(nextPath); }, { timeout: 2500 });
  const fallbackHandle = idleHandle == null
    ? window.setTimeout(() => void preloadRoute(nextPath), 1800)
    : null;

  return () => {
    if (idleHandle != null) idleWindow.cancelIdleCallback?.(idleHandle);
    if (fallbackHandle != null) window.clearTimeout(fallbackHandle);
  };
}

export function RoutePreloadManager() {
  const { pathname } = useLocation();

  useEffect(() => installIntentListeners(), []);
  useEffect(() => scheduleLikelyRoute(pathname), [pathname]);

  return null;
}
