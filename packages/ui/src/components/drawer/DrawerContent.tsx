// packages/ui/src/components/drawer/DrawerContent.tsx

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Music,
  Calendar,
  Monitor,
  Image,
  Settings,
  Menu,
  ChevronLeft,
  LogOut,
  User,
} from 'lucide-react-native';
import { useDrawer } from './DrawerContext';
import { DrawerItem } from './DrawerItem';
import { brandColors } from '../../theme';

interface DrawerContentProps {
  /** App name to display in header */
  appName?: string;
  /** Current user info */
  user?: {
    name: string;
    email?: string;
  } | null;
  /** Callback when sign out is pressed */
  onSignOut?: () => void;
  /** Custom navigation items (overrides defaults) */
  items?: Array<{
    route: string;
    label: string;
    icon: LucideIcon;
  }>;
  /** Translation function for labels */
  t?: (key: string) => string;
}

const defaultItems = [
  { route: 'Songs', label: 'Songs', icon: Music },
  { route: 'Events', label: 'Events', icon: Calendar },
  { route: 'Displays', label: 'Displays', icon: Monitor },
  { route: 'Media', label: 'Media', icon: Image },
];

export function DrawerContent({
  appName = 'Mobile Worship',
  user,
  onSignOut,
  items,
  t = (key) => key,
}: DrawerContentProps) {
  const { isExpanded, toggle, width, state } = useDrawer();
  const navItems = items ?? defaultItems;

  if (state === 'hidden') {
    return null;
  }

  return (
    <View
      style={{
        width,
        height: '100%',
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: '#e5e7eb',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          minHeight: 64,
        }}
      >
        {isExpanded && (
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: brandColors.primary600,
            }}
          >
            {appName}
          </Text>
        )}
        <Pressable
          onPress={toggle}
          style={{
            padding: 8,
            borderRadius: 8,
          }}
        >
          {isExpanded ? (
            <ChevronLeft size={20} color="#6b7280" />
          ) : (
            <Menu size={20} color="#6b7280" />
          )}
        </Pressable>
      </View>

      {/* Navigation Items */}
      <ScrollView style={{ flex: 1, paddingTop: 8 }}>
        {navItems.map((item) => (
          <DrawerItem
            key={item.route}
            route={item.route}
            label={t(`nav.${item.route.toLowerCase()}`) || item.label}
            icon={item.icon}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        {/* Settings */}
        <DrawerItem
          route="Settings"
          label={t('nav.settings') || 'Settings'}
          icon={Settings}
        />

        {/* User info and sign out */}
        {user && (
          <View
            style={{
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: isExpanded ? 'space-between' : 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: brandColors.primary100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={16} color={brandColors.primary600} />
              </View>
              {isExpanded && (
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
                    {user.name}
                  </Text>
                  {user.email && (
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{user.email}</Text>
                  )}
                </View>
              )}
            </View>
            {isExpanded && onSignOut && (
              <Pressable onPress={onSignOut} style={{ padding: 8 }}>
                <LogOut size={18} color="#6b7280" />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
