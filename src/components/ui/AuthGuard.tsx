import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useICAuth } from "@/hooks/useICAuth";

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const AuthGuard = ({ children, redirectTo = "/login" }: AuthGuardProps) => {
  const { user, loading } = useAuth();
  const { isAuthenticated: icAuthenticated, loading: icLoading } = useICAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Allow access if either Supabase or IC authentication is valid
    const isAuthenticated = user || icAuthenticated;
    const isLoading = loading || icLoading;
    
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo);
    }
  }, [user, loading, icAuthenticated, icLoading, navigate, redirectTo]);

  const isAuthenticated = user || icAuthenticated;
  const isLoading = loading || icLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;