import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@mobileworship/shared';

const navItems = [
  { to: '/dashboard/songs', label: 'Songs' },
  { to: '/dashboard/events', label: 'Events' },
  { to: '/dashboard/media', label: 'Media' },
  { to: '/dashboard/settings', label: 'Settings' },
];

export function DashboardLayout() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Mobile Worship</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{user.name}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Sign Out
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
