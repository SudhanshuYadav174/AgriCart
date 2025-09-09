import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const RoleRedirect = () => {
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
  switch (role) {
    case 'admin':
      return <Navigate to="/dashboard/admin" replace />;
    case 'qa_agency':
    case 'qa':
      return <Navigate to="/dashboard/qa" replace />;
    case 'importer':
      return <Navigate to="/dashboard/importer" replace />;
    case 'exporter':
    default:
      return <Navigate to="/dashboard/exporter" replace />;
  }
};

export default RoleRedirect;
