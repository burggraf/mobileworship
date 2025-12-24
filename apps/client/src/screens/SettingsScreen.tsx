import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '@mobileworship/shared';

export function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 p-4">
      <View className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
        <Text className="text-sm text-gray-500 dark:text-gray-400">Name</Text>
        <Text className="font-medium dark:text-white">{user?.name}</Text>
      </View>

      <View className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
        <Text className="text-sm text-gray-500 dark:text-gray-400">Email</Text>
        <Text className="font-medium dark:text-white">{user?.email}</Text>
      </View>

      <View className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-8">
        <Text className="text-sm text-gray-500 dark:text-gray-400">Role</Text>
        <Text className="font-medium capitalize dark:text-white">{user?.role}</Text>
      </View>

      <TouchableOpacity
        className="p-4 border border-red-500 rounded-lg"
        onPress={() => signOut()}
      >
        <Text className="text-red-500 text-center font-medium">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
