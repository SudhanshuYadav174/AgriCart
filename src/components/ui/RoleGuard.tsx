import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useICAuth } from "@/hooks/useICAuth";

type RoleGuardProps = {
  allow: string[]; // allowed roles (lowercase)
  children: ReactNode;
};

const RoleGuard = ({ allow, children }: RoleGuardProps) => {
  const { user, profile, loading } = useAuth();
  const { isAuthenticated: icAuthenticated, loading: icLoading } = useICAuth();

  if (loading || icLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated with IC but not Supabase, allow access to exporter dashboard
  if (icAuthenticated && !user) {
    // IC users can only access exporter dashboard for now
    if (allow.includes('exporter')) {
      return <>{children}</>;
    } else {
      // Redirect IC users to exporter dashboard if they try to access other roles
      return <Navigate to="/dashboard/exporter" replace />;
    }
  }

  if (!user) return <Navigate to="/login" replace />;

  const role = (profile?.role || user.user_metadata?.role || '').toLowerCase();
  if (!allow.includes(role)) {
    // Send to the generic dashboard which will redirect based on role
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
