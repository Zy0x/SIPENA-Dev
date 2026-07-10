import { useState } from "react";
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
import PWAManager from "@/components/PWAManager";
import { RotationOverlay } from "@/components/RotationOverlay";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ExternalAuthOnboarding } from "@/components/onboarding/ExternalAuthOnboarding";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { ThemePreferenceSync } from "@/components/theme/ThemePreferenceSync";
import { ViewportTelemetryReporter } from "@/hooks/useViewportTelemetry";
import { useTouchScrollClickGuard } from "@/hooks/useTouchScrollClickGuard";
import { FeatureFlagProvider } from "@/app/providers/FeatureFlagProvider";
import { FEATURE_KEYS } from "@/app/providers/featureAccess";
import { FeatureRouteGuard } from "@/components/FeatureGate";
import AttendanceRuntimeRoute from "@/features/attendance/runtime/AttendanceRuntimeRoute";
import AttendanceStableRoute from "@/features/attendance/stable/AttendanceStableRoute";

// Pages
import Index from "../pages/Index";
import Auth from "../pages/Auth";
import Dashboard from "../pages/Dashboard";
import Classes from "../pages/Classes";
import Subjects from "../pages/Subjects";
import Grades from "../pages/Grades";
import Reports from "../pages/Reports";
import GradeReports from "../pages/GradeReports";
import StudentRankings from "../pages/StudentRankings";
import Settings from "../pages/Settings";
import Profile from "../pages/Profile";
import Help from "../pages/Help";
import About from "../pages/About";
import NotFound from "../pages/NotFound";
import GuestAccess from "../pages/GuestAccess";
import Admin from "../pages/Admin";
import Changelog from "../pages/Changelog";
import ParentPortal from "../pages/ParentPortal";
import PortalView from "../pages/PortalView";
import MorpheChat from "../pages/MorpheChat";
import Terms from "../pages/Terms";

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

  // Show splash screen only on first visit or PWA launch
  const [showSplash, setShowSplash] = useState(() => {
    const isPWA = window.matchMedia("(display-mode: standalone)").matches;
    const hasSeenSplash = sessionStorage.getItem("sipena_splash_shown");
    return isPWA && !hasSeenSplash;
  });

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem("sipena_splash_shown", "true");
  };

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
              <PWAManager />
              <ExternalAuthOnboarding />
              <MaintenanceBanner />
              
              {showSplash && (
                <SplashScreen onComplete={handleSplashComplete} minDuration={1400} />
              )}
              
              <BrowserRouter>
                <ViewportTelemetryReporter />
                <KeyboardShortcutsProvider>
                  <ErrorBoundary fallbackTitle="Aplikasi mengalami error">
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
                  </ErrorBoundary>
                  <RotationOverlay />
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
