// packages/ui/src/components/drawer/DrawerItem.tsx

import React from 'react';
import { Pressable, Text } from 'react-native';
import { useDrawer } from './DrawerContext';
import { brandColors } from '../../theme';

interface DrawerItemProps {
  route: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

export function DrawerItem({ route, label, icon: Icon }: DrawerItemProps) {
  const { activeRoute, onNavigate, isExpanded } = useDrawer();
  const isActive = activeRoute === route;

  return (
    <Pressable
      onPress={() => onNavigate(route)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: isActive ? `${brandColors.primary500}15` : 'transparent',
        marginHorizontal: 8,
        marginVertical: 2,
      }}
    >
      <Icon
        size={22}
        color={isActive ? brandColors.primary600 : '#6b7280'}
        strokeWidth={isActive ? 2.5 : 2}
      />
      {isExpanded && (
        <Text
          style={{
            marginLeft: 12,
            fontSize: 15,
            fontWeight: isActive ? '600' : '400',
            color: isActive ? brandColors.primary600 : '#374151',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
