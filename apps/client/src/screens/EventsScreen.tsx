import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEvents, useAuth } from '@mobileworship/shared';
import type { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function EventsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { events, isLoading } = useEvents();
  const { can } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500">Loading events...</Text>
      </View>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-200',
    ready: 'bg-blue-200',
    live: 'bg-green-200',
    completed: 'bg-gray-100',
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4"
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500">No events yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="p-4 border-b border-gray-200 dark:border-gray-700 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="font-semibold dark:text-white">{item.title}</Text>
              {item.scheduled_at && (
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(item.scheduled_at).toLocaleDateString()}
                </Text>
              )}
            </View>
            <View className="flex-row items-center gap-3">
              <View className={`px-2 py-1 rounded ${statusColors[item.status]}`}>
                <Text className="text-xs capitalize">{item.status}</Text>
              </View>
              {can('control:operate') && item.status !== 'completed' && (
                <TouchableOpacity
                  className="bg-primary-600 px-4 py-2 rounded"
                  onPress={() => navigation.navigate('Control', { eventId: item.id })}
                >
                  <Text className="text-white text-sm font-medium">Control</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}
