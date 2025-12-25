import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useAuth, useSupabase } from '@mobileworship/shared';

export function DashboardLayout() {
  const { t } = useTranslation();
  const { user, isLoading, signOut } = useAuth();
  const supabase = useSupabase();
  const [churchName, setChurchName] = useState('');

  useEffect(() => {
    if (user?.churchId) {
      supabase
        .from('churches')
        .select('name')
        .eq('id', user.churchId)
        .single()
        .then(({ data }) => {
          if (data) setChurchName(data.name);
        });
    }
  }, [user?.churchId, supabase]);

  const navItems = [
    { to: '/dashboard/songs', label: t('nav.songs') },
    { to: '/dashboard/events', label: t('nav.events') },
    { to: '/dashboard/displays', label: t('nav.displays') },
    { to: '/dashboard/media', label: t('nav.media') },
    { to: '/dashboard/settings', label: t('nav.settings') },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">{t('app.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">{t('app.name')}</h1>
            {user && churchName && (
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline ml-2">
                · {churchName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{user.name}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              {t('nav.signOut')}
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4">
          <ul className="flex gap-6">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block py-3 border-b-2 transition ${
                      isActive
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <Outlet />
      </main>
    </div>
  );
}
