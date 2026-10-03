import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import OrchestraEV from "./pages/OrchestraEV";
import FleetCommandOttoQ from "./pages/FleetCommandOttoQ";
import Auth from "./pages/Auth";
import ProfileSettings from "./pages/ProfileSettings";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import AdminUsers from "./pages/AdminUsers";
import ProtectedRoute from "./components/ProtectedRoute";
import { UpdateBanner } from "./components/UpdateBanner";
import { useServiceWorker } from "./hooks/useServiceWorker";
import { LOGIN_REQUIRED } from "./lib/openDemo";
import type { ReactNode } from "react";

/** A page that exists only for a signed-in account: in the open demo it leads to the cockpit (src/lib/openDemo.ts). */
const accountOnly = (page: ReactNode) => (LOGIN_REQUIRED ? page : <Navigate to="/" replace />);

const queryClient = new QueryClient();

function AppContent() {
  const { isUpdateAvailable, updateServiceWorker } = useServiceWorker();

  return (
    <>
      <Toaster />
      <Sonner />
      {isUpdateAvailable && <UpdateBanner onUpdate={updateServiceWorker} />}
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={accountOnly(<Auth />)} />
          <Route path="/reset-password" element={accountOnly(<ResetPassword />)} />
          <Route path="/install" element={<Install />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/orchestra-ev" element={<ProtectedRoute><OrchestraEV /></ProtectedRoute>} />
          <Route path="/fleet-command/otto-q" element={<ProtectedRoute><FleetCommandOttoQ /></ProtectedRoute>} />
          <Route path="/profile" element={accountOnly(<ProtectedRoute><ProfileSettings /></ProtectedRoute>)} />
          <Route path="/admin/users" element={accountOnly(<ProtectedRoute><AdminUsers /></ProtectedRoute>)} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
