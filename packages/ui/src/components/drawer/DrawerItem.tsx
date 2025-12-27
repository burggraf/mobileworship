// packages/ui/src/components/drawer/DrawerItem.tsx


import { Pressable, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useDrawer } from './DrawerContext';
import { brandColors, semanticColors } from '../../theme';

interface DrawerItemProps {
  route: string;
  label: string;
  icon: LucideIcon;
}

export function DrawerItem({ route, label, icon: Icon }: DrawerItemProps) {
  const { activeRoute, onNavigate, isExpanded, colorScheme } = useDrawer();
  const isActive = activeRoute === route;
  const colors = semanticColors[colorScheme];

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
        color={isActive ? brandColors.primary600 : colors.textSecondary}
        strokeWidth={isActive ? 2.5 : 2}
      />
      {isExpanded && (
        <Text
          style={{
            marginLeft: 12,
            fontSize: 15,
            fontWeight: isActive ? '600' : '400',
            color: isActive ? brandColors.primary600 : colors.text,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
