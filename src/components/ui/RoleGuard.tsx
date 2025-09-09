import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type RoleGuardProps = {
  allow: string[]; // allowed roles (lowercase)
  children: ReactNode;
};

const RoleGuard = ({ allow, children }: RoleGuardProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
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
