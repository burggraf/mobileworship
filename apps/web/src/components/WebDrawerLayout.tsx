// apps/web/src/components/WebDrawerLayout.tsx


import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@mobileworship/shared';
import { AppLayout } from '@mobileworship/ui';
import { useTheme } from '../contexts/ThemeContext';

interface WebDrawerLayoutProps {
  children: ReactNode;
}

// Map routes to drawer route names
const routeMap: Record<string, string> = {
  '/dashboard/songs': 'Songs',
  '/dashboard/events': 'Events',
  '/dashboard/displays': 'Displays',
  '/dashboard/media': 'Media',
  '/dashboard/settings': 'Settings',
};

const reverseRouteMap: Record<string, string> = {
  Songs: '/dashboard/songs',
  Events: '/dashboard/events',
  Displays: '/dashboard/displays',
  Media: '/dashboard/media',
  Settings: '/dashboard/settings',
};

export function WebDrawerLayout({ children }: WebDrawerLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { theme } = useTheme();

  // Determine active route from current path
  const activeRoute = Object.entries(routeMap).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] ?? 'Songs';

  const handleNavigate = (route: string) => {
    const path = reverseRouteMap[route];
    if (path) {
      navigate(path);
    }
  };

  return (
    <AppLayout
      activeRoute={activeRoute}
      onNavigate={handleNavigate}
      user={user ? { name: user.name, email: user.email } : null}
      onSignOut={signOut}
      t={t}
      colorScheme={theme}
    >
      {children}
    </AppLayout>
  );
}
