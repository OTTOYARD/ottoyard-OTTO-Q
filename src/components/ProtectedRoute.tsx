import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { LOGIN_REQUIRED } from "@/lib/openDemo";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/** The open demo lets everyone through (src/lib/openDemo.ts); with VITE_REQUIRE_LOGIN=1 a page needs a session. */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  return LOGIN_REQUIRED ? <SignedInOnly>{children}</SignedInOnly> : <>{children}</>;
}

function SignedInOnly({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const rememberMe = localStorage.getItem('rememberMe');
      
      if (session && rememberMe !== 'true') {
        supabase.auth.signOut();
        setAuthenticated(false);
      } else {
        setAuthenticated(!!session);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="surface-luxury rounded-2xl p-8 flex flex-col items-center animate-fade-in-scale">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
