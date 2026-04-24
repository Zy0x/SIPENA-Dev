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
import LayoutRoute from "@/components/LayoutRoute";
import PWAManager from "@/components/PWAManager";
import { RotationOverlay } from "@/components/RotationOverlay";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ExternalAuthOnboarding } from "@/components/onboarding/ExternalAuthOnboarding";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Classes from "./pages/Classes";
import Attendance from "./pages/Attendance";
import Subjects from "./pages/Subjects";
import Grades from "./pages/Grades";
import Reports from "./pages/Reports";
import GradeReports from "./pages/GradeReports";
import StudentRankings from "./pages/StudentRankings";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import GuestAccess from "./pages/GuestAccess";
import GuestGrades from "./pages/GuestGrades";
import Admin from "./pages/Admin";
import Changelog from "./pages/Changelog";
import ParentPortal from "./pages/ParentPortal";
import PortalView from "./pages/PortalView";
import MorpheChat from "./pages/MorpheChat";
import Terms from "./pages/Terms";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
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
        <ToastProvider>
          <AcademicYearProvider>
            <TooltipProvider delayDuration={0}>
              <Toaster />
              <Sonner />
              <PWAManager />
              <ExternalAuthOnboarding />
              <MaintenanceBanner />
              
              {showSplash && (
                <SplashScreen onComplete={handleSplashComplete} minDuration={2500} />
              )}
              
              <BrowserRouter>
                <KeyboardShortcutsProvider>
                  <ErrorBoundary fallbackTitle="Aplikasi mengalami error">
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/share" element={<GuestAccess />} />
                    <Route path="/guest/grades" element={<GuestGrades />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/changelog" element={<Changelog />} />
                    <Route path="/portal/:code" element={<PortalView />} />
                    <Route path="/terms" element={<Terms />} />

                    {/* Morphe AI - fullscreen route (no sidebar) */}
                    <Route path="/morphe" element={<ProtectedRoute><MorpheChat /></ProtectedRoute>} />

                    {/* Protected routes with persistent layout (sidebar won't reload) */}
                    <Route element={<ProtectedRoute><LayoutRoute /></ProtectedRoute>}>
                      <Route path="/dashboard" element={
                        <ErrorBoundary fallbackTitle="Dashboard error">
                          <Dashboard />
                        </ErrorBoundary>
                      } />
                      <Route path="/classes" element={<Classes />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/subjects" element={<Subjects />} />
                      <Route path="/grades" element={<Grades />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/reports/grades" element={<GradeReports />} />
                      <Route path="/reports/rankings" element={<StudentRankings />} />
                      <Route path="/reports/portal" element={<ParentPortal />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/profile" element={<Profile />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="/about" element={<About />} />
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
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
