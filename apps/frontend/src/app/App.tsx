import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { AcademicYearProvider } from "@/contexts/AcademicYearContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";
import LayoutRoute from "@/components/LayoutRoute";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemePreferenceSync } from "@/components/theme/ThemePreferenceSync";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { useTouchScrollClickGuard } from "@/hooks/useTouchScrollClickGuard";
import { FeatureFlagProvider } from "@/app/providers/FeatureFlagProvider";
import { FEATURE_KEYS } from "@/app/providers/featureAccess";
import { FeatureRouteGuard } from "@/components/FeatureGate";
import { loadRouteWithRecovery, RoutePreloadManager, routeModules } from "@/app/routePreload";
import { RouteTransitionFallback } from "@/components/RouteTransitionFallback";

// Pages
const Index = lazy(() => loadRouteWithRecovery("index", routeModules.index));
const Auth = lazy(() => loadRouteWithRecovery("auth", routeModules.auth));
const Dashboard = lazy(() => loadRouteWithRecovery("dashboard", routeModules.dashboard));
const Classes = lazy(() => loadRouteWithRecovery("classes", routeModules.classes));
const Subjects = lazy(() => loadRouteWithRecovery("subjects", routeModules.subjects));
const Grades = lazy(() => loadRouteWithRecovery("grades", routeModules.grades));
const Reports = lazy(() => loadRouteWithRecovery("reports", routeModules.reports));
const GradeReports = lazy(() => loadRouteWithRecovery("gradeReports", routeModules.gradeReports));
const StudentRankings = lazy(() => loadRouteWithRecovery("rankings", routeModules.rankings));
const Settings = lazy(() => loadRouteWithRecovery("settings", routeModules.settings));
const Profile = lazy(() => loadRouteWithRecovery("profile", routeModules.profile));
const Help = lazy(() => loadRouteWithRecovery("help", routeModules.help));
const About = lazy(() => loadRouteWithRecovery("about", routeModules.about));
const NotFound = lazy(() => loadRouteWithRecovery("notFound", routeModules.notFound));
const GuestAccess = lazy(() => loadRouteWithRecovery("guestAccess", routeModules.guestAccess));
const Admin = lazy(() => loadRouteWithRecovery("admin", routeModules.admin));
const Changelog = lazy(() => loadRouteWithRecovery("changelog", routeModules.changelog));
const ParentPortal = lazy(() => loadRouteWithRecovery("parentPortal", routeModules.parentPortal));
const PortalView = lazy(() => loadRouteWithRecovery("portalView", routeModules.portalView));
const MorpheChat = lazy(() => loadRouteWithRecovery("morphe", routeModules.morphe));
const Terms = lazy(() => loadRouteWithRecovery("terms", routeModules.terms));
const AttendanceRuntimeRoute = lazy(() => loadRouteWithRecovery("attendanceRuntime", routeModules.attendanceRuntime));
const AttendanceStableRoute = lazy(() => loadRouteWithRecovery("attendanceStable", routeModules.attendanceStable));
const PWAManager = lazy(() => import("@/components/PWAManager"));
const ExternalAuthOnboarding = lazy(() =>
  import("@/components/onboarding/ExternalAuthOnboarding").then((module) => ({ default: module.ExternalAuthOnboarding })),
);
const RotationOverlay = lazy(() =>
  import("@/components/RotationOverlay").then((module) => ({ default: module.RotationOverlay })),
);
const ViewportTelemetryReporter = lazy(() =>
  import("@/hooks/useViewportTelemetry").then((module) => ({ default: module.ViewportTelemetryReporter })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function BootSplashHandoff() {
  const { loading } = useAuth();

  useEffect(() => {
    const splash = document.getElementById("sipena-boot-splash");
    if (!splash) return;

    const close = () => {
      splash.setAttribute("data-closing", "true");
      window.setTimeout(() => splash.remove(), 220);
    };
    const readyTimer = !loading ? window.setTimeout(close, 80) : null;
    const safetyTimer = window.setTimeout(close, 2_500);

    return () => {
      if (readyTimer != null) window.clearTimeout(readyTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [loading]);

  return null;
}

const App = () => {
  useTouchScrollClickGuard();
  const [nonCriticalReady, setNonCriticalReady] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleHandle = idleWindow.requestIdleCallback?.(() => setNonCriticalReady(true), { timeout: 1800 });
    const idleFallback = idleHandle == null ? window.setTimeout(() => setNonCriticalReady(true), 1200) : null;

    return () => {
      if (idleHandle != null) idleWindow.cancelIdleCallback?.(idleHandle);
      if (idleFallback != null) window.clearTimeout(idleFallback);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BootSplashHandoff />
        <FeatureFlagProvider>
          <ToastProvider>
            <AcademicYearProvider>
            <TooltipProvider delayDuration={0}>
              <ThemePreferenceSync />
              <Toaster />
              <Sonner />
              <Suspense fallback={null}>
                <MaintenanceBanner />
                {nonCriticalReady && <PWAManager />}
                {nonCriticalReady && <ExternalAuthOnboarding />}
              </Suspense>
              
              <BrowserRouter>
                <RoutePreloadManager />
                {nonCriticalReady && <Suspense fallback={null}><ViewportTelemetryReporter /></Suspense>}
                <KeyboardShortcutsProvider>
                  <ErrorBoundary fallbackTitle="Aplikasi mengalami error">
                  <Suspense fallback={<RouteTransitionFallback />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/share" element={<GuestAccess />} />
                    <Route path="/guest/grades" element={<Grades mode="guest" />} />
                    <Route path="/admin" element={
                      <AdminRouteGuard>
                        <Admin />
                      </AdminRouteGuard>
                    } />
                    <Route path="/changelog" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.changelog}><Changelog /></FeatureRouteGuard>} />
                    <Route path="/portal/:code" element={<PortalView />} />
                    <Route path="/terms" element={<Terms />} />

                    {/* Morphe AI - fullscreen route (no sidebar) */}
                    <Route path="/morphe" element={
                      <ProtectedRoute>
                        <FeatureRouteGuard featureKey={FEATURE_KEYS.morphe} label="Morphe AI">
                          <MorpheChat />
                        </FeatureRouteGuard>
                      </ProtectedRoute>
                    } />

                    {/* Protected routes with persistent layout (sidebar won't reload) */}
                    <Route element={<ProtectedRoute><LayoutRoute /></ProtectedRoute>}>
                      <Route path="/dashboard" element={
                        <FeatureRouteGuard featureKey={FEATURE_KEYS.dashboard}>
                          <ErrorBoundary fallbackTitle="Dashboard error">
                            <Dashboard />
                          </ErrorBoundary>
                        </FeatureRouteGuard>
                      } />
                      <Route path="/classes" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.classes}><Classes /></FeatureRouteGuard>} />
                      <Route path="/attendance" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.attendance}><AttendanceStableRoute /></FeatureRouteGuard>} />
                      <Route path="/attendance-v2" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.attendanceV2}><AttendanceRuntimeRoute forcedEngine="v2" /></FeatureRouteGuard>} />
                      <Route path="/subjects" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.subjects}><Subjects /></FeatureRouteGuard>} />
                      <Route path="/grades" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.grades}><Grades /></FeatureRouteGuard>} />
                      <Route path="/reports" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.reports}><Reports /></FeatureRouteGuard>} />
                      <Route path="/reports/grades" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.gradeReports}><GradeReports /></FeatureRouteGuard>} />
                      <Route path="/reports/rankings" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.rankings}><StudentRankings /></FeatureRouteGuard>} />
                      <Route path="/reports/portal" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.parentPortal}><ParentPortal /></FeatureRouteGuard>} />
                      <Route path="/settings" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.settings}><Settings /></FeatureRouteGuard>} />
                      <Route path="/settings/profile" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.settings}><Profile /></FeatureRouteGuard>} />
                      <Route path="/help" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.help}><Help /></FeatureRouteGuard>} />
                      <Route path="/about" element={<FeatureRouteGuard featureKey={FEATURE_KEYS.about}><About /></FeatureRouteGuard>} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </Suspense>
                  </ErrorBoundary>
                  {nonCriticalReady && <Suspense fallback={null}><RotationOverlay /></Suspense>}
                </KeyboardShortcutsProvider>
              </BrowserRouter>
            </TooltipProvider>
            </AcademicYearProvider>
          </ToastProvider>
        </FeatureFlagProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
