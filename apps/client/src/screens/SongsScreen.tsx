import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSongs } from '@mobileworship/shared';

export function SongsScreen() {
  const { songs, isLoading } = useSongs();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500">Loading songs...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4"
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500">No songs yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Text className="font-semibold dark:text-white">{item.title}</Text>
            {item.author && (
              <Text className="text-sm text-gray-600 dark:text-gray-400">{item.author}</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
