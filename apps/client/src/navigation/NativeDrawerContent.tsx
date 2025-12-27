// apps/client/src/navigation/NativeDrawerContent.tsx

import React from 'react';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuth } from '@mobileworship/shared';
import { DrawerProvider, DrawerContent } from '@mobileworship/ui';

export function NativeDrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const { state, navigation } = props;

  // Get current route name
  const currentRoute = state.routes[state.index]?.name ?? 'Songs';

  const handleNavigate = (route: string) => {
    navigation.navigate(route);
  };

  return (
    <DrawerProvider activeRoute={currentRoute} onNavigate={handleNavigate}>
      <DrawerContent
        user={user ? { name: user.name, email: user.email } : null}
        onSignOut={signOut}
      />
    </DrawerProvider>
  );
}
