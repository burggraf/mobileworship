// apps/client/src/screens/displays/DisplaysListScreen.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDisplays, isDisplayOnline } from '@mobileworship/shared';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never';
  const date = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay} days ago`;
}

export function DisplaysListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { displays, isLoading, refetch, removeDisplay } = useDisplays();

  const handleRemove = (displayId: string, displayName: string) => {
    Alert.alert(
      'Remove Display',
      `Are you sure you want to remove "${displayName}"? The display will need to be paired again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeDisplay.mutate(displayId),
        },
      ]
    );
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddDisplay')}
          className="mr-4"
        >
          <Text className="text-blue-500 text-lg font-semibold">+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (displays.length === 0 && !isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center p-8">
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
          No displays paired yet
        </Text>
        <TouchableOpacity
          className="bg-blue-500 px-6 py-3 rounded-lg"
          onPress={() => navigation.navigate('AddDisplay')}
        >
          <Text className="text-white font-semibold">Add Display</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={displays}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        renderItem={({ item }) => {
          const online = isDisplayOnline(item.lastSeenAt);
          return (
            <TouchableOpacity
              className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700"
              onPress={() => navigation.navigate('DisplayDetail', { displayId: item.id })}
              onLongPress={() => handleRemove(item.id, item.name)}
            >
              <View
                className={`w-3 h-3 rounded-full mr-3 ${
                  online ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <View className="flex-1">
                <Text className="font-semibold text-gray-900 dark:text-white">
                  {item.name}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Last seen: {formatLastSeen(item.lastSeenAt)}
                </Text>
              </View>
              <Text className="text-gray-400 text-xl">›</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
