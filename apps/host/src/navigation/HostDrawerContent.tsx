// apps/host/src/navigation/HostDrawerContent.tsx

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Monitor, Settings, QrCode } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { brandColors } from '@mobileworship/ui';

interface NavItemProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onPress: () => void;
}

function NavItem({ label, icon: Icon, isActive, onPress }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
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
    </Pressable>
  );
}

interface HostDrawerContentProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function HostDrawerContent({ activeRoute, onNavigate }: HostDrawerContentProps) {
  const navItems = [
    { route: 'Display', label: 'Display', icon: Monitor },
    { route: 'Pairing', label: 'Pairing', icon: QrCode },
    { route: 'Settings', label: 'Settings', icon: Settings },
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: '#e5e7eb',
      }}
    >
      {/* Header */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          minHeight: 64,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: brandColors.primary600,
          }}
        >
          Mobile Worship
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: '#6b7280',
            marginTop: 2,
          }}
        >
          Display Host
        </Text>
      </View>

      {/* Navigation Items */}
      <ScrollView style={{ flex: 1, paddingTop: 8 }}>
        {navItems.map((item) => (
          <NavItem
            key={item.route}
            label={item.label}
            icon={item.icon}
            isActive={activeRoute === item.route}
            onPress={() => onNavigate(item.route)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
