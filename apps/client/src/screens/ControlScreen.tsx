import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { HostState, ConnectionInfo } from '@mobileworship/protocol';

type ControlRouteProp = RouteProp<RootStackParamList, 'Control'>;

export function ControlScreen() {
  const route = useRoute<ControlRouteProp>();
  const navigation = useNavigation();
  const { eventId } = route.params;

  const [connection, setConnection] = useState<ConnectionInfo>({
    status: 'disconnected',
    type: null,
    hostId: null,
    latency: null,
  });

  const [hostState, setHostState] = useState<HostState | null>(null);

  // TODO: Implement actual connection logic using LocalConnection/RemoteConnection

  function handlePrevious() {
    // Send PREV_SLIDE command
  }

  function handleNext() {
    // Send NEXT_SLIDE command
  }

  function handleBlank() {
    // Send BLANK_SCREEN command
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary-600">Close</Text>
        </TouchableOpacity>
        <Text className="font-bold dark:text-white">Live Control</Text>
        <View className="flex-row items-center gap-2">
          <View
            className={`w-2 h-2 rounded-full ${
              connection.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <Text className="text-sm text-gray-500">
            {connection.status === 'connected'
              ? connection.type === 'local'
                ? 'Local'
                : 'Cloud'
              : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Current/Next Preview */}
      <View className="flex-row p-4 gap-4">
        <View className="flex-1">
          <Text className="text-xs text-gray-500 mb-2">Current</Text>
          <View className="aspect-video bg-black rounded-lg items-center justify-center">
            <Text className="text-gray-400">No slide</Text>
          </View>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-gray-500 mb-2">Next</Text>
          <View className="aspect-video bg-gray-800 rounded-lg items-center justify-center">
            <Text className="text-gray-500">-</Text>
          </View>
        </View>
      </View>

      {/* Song Sections */}
      <ScrollView className="flex-1 px-4">
        <Text className="font-semibold mb-3 dark:text-white">Sections</Text>
        {/* TODO: Render song sections as tappable buttons */}
        <View className="items-center py-8">
          <Text className="text-gray-500">Select a song from the service order</Text>
        </View>
      </ScrollView>

      {/* Control Bar */}
      <View className="flex-row items-center justify-center gap-4 p-4 border-t border-gray-200 dark:border-gray-700">
        <TouchableOpacity
          className="px-6 py-4 bg-gray-200 dark:bg-gray-700 rounded-lg"
          onPress={handlePrevious}
        >
          <Text className="font-medium dark:text-white">Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="px-6 py-4 bg-gray-800 rounded-lg"
          onPress={handleBlank}
        >
          <Text className="text-white font-medium">Blank</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="px-8 py-4 bg-primary-600 rounded-lg"
          onPress={handleNext}
        >
          <Text className="text-white font-semibold text-lg">Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
