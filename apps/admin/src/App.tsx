import { DashboardPage } from './pages/dashboard/DashboardPage';
import { useEffect, useState } from 'react';
import { ADMIN_SESSION_EXPIRED_EVENT, hasAdminSession } from './services/admin-session';
import { AdminLogin } from './features/auth/AdminLogin';

export default function App() {
  const [authenticated, setAuthenticated] = useState(hasAdminSession());
  useEffect(() => {
    const expired = () => setAuthenticated(false);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, expired);
  }, []);
  return authenticated ? (
    <DashboardPage onLoggedOut={() => setAuthenticated(false)} />
  ) : (
    <AdminLogin onSuccess={() => setAuthenticated(true)} />
  );
}
