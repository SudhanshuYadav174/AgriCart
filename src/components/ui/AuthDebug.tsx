import { useAuth } from "@/hooks/useAuth";

const AuthDebug = () => {
  if (import.meta.env.MODE !== 'development') return null;
  const { user, profile, loading } = useAuth();
  return (
    <div style={{position:'fixed', bottom: 8, right: 8, zIndex: 9999}}>
      <div className="text-xs bg-black/70 text-white rounded px-2 py-1">
        <div>auth.loading: {String(loading)}</div>
        <div>user: {user ? user.email : 'null'}</div>
        <div>meta.role: {user?.user_metadata?.role ?? 'null'}</div>
        <div>profile.role: {profile?.role ?? 'null'}</div>
      </div>
    </div>
  );
};

export default AuthDebug;
