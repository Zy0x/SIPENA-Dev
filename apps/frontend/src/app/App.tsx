import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import { Loader2 } from "lucide-react";

// Pages
const Index = lazy(() => import("../pages/Index"));
const Auth = lazy(() => import("../pages/Auth"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Classes = lazy(() => import("../pages/Classes"));
const Subjects = lazy(() => import("../pages/Subjects"));
const Grades = lazy(() => import("../pages/Grades"));
const Reports = lazy(() => import("../pages/Reports"));
const GradeReports = lazy(() => import("../pages/GradeReports"));
const StudentRankings = lazy(() => import("../pages/StudentRankings"));
const Settings = lazy(() => import("../pages/Settings"));
const Profile = lazy(() => import("../pages/Profile"));
const Help = lazy(() => import("../pages/Help"));
const About = lazy(() => import("../pages/About"));
const NotFound = lazy(() => import("../pages/NotFound"));
const GuestAccess = lazy(() => import("../pages/GuestAccess"));
const Admin = lazy(() => import("../pages/Admin"));
const Changelog = lazy(() => import("../pages/Changelog"));
const ParentPortal = lazy(() => import("../pages/ParentPortal"));
const PortalView = lazy(() => import("../pages/PortalView"));
const MorpheChat = lazy(() => import("../pages/MorpheChat"));
const Terms = lazy(() => import("../pages/Terms"));
const AttendanceRuntimeRoute = lazy(() => import("@/features/attendance/runtime/AttendanceRuntimeRoute"));
const AttendanceStableRoute = lazy(() => import("@/features/attendance/stable/AttendanceStableRoute"));
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

function RouteLoading() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center px-4 py-8" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat halaman...
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  useTouchScrollClickGuard();
  const [nonCriticalReady, setNonCriticalReady] = useState(false);

  useEffect(() => {
    const splash = document.getElementById("sipena-boot-splash");
    if (!splash) return;

    const closeSplash = window.setTimeout(() => {
      splash.setAttribute("data-closing", "true");
      window.setTimeout(() => splash.remove(), 220);
    }, 360);

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleHandle = idleWindow.requestIdleCallback?.(() => setNonCriticalReady(true), { timeout: 1800 });
    const idleFallback = idleHandle == null ? window.setTimeout(() => setNonCriticalReady(true), 1200) : null;

    return () => {
      window.clearTimeout(closeSplash);
      if (idleHandle != null) idleWindow.cancelIdleCallback?.(idleHandle);
      if (idleFallback != null) window.clearTimeout(idleFallback);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
                {nonCriticalReady && <Suspense fallback={null}><ViewportTelemetryReporter /></Suspense>}
                <KeyboardShortcutsProvider>
                  <ErrorBoundary fallbackTitle="Aplikasi mengalami error">
                  <Suspense fallback={<RouteLoading />}>
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
