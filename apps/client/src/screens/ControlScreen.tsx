import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '@mobileworship/shared';
import { useDisplayConnection } from '../hooks/useDisplayConnection';

type ControlRouteProp = RouteProp<RootStackParamList, 'Control'>;

export function ControlScreen() {
  const route = useRoute<ControlRouteProp>();
  const navigation = useNavigation();
  const { eventId, authToken: paramToken } = route.params;
  const { session } = useAuth();

  // Use token from params if provided, otherwise from session
  const authToken = paramToken || session?.access_token || '';

  const { connectionStatus, hostStates, sendCommand, reconnect } =
    useDisplayConnection({
      eventId,
      authToken,
    });

  // Get first host state for display (multi-display shows same content)
  const hostState = hostStates.size > 0
    ? Array.from(hostStates.values())[0]
    : null;

  function handlePrevious() {
    sendCommand({ type: 'PREV_SLIDE' });
  }

  function handleNext() {
    sendCommand({ type: 'NEXT_SLIDE' });
  }

  function handleBlank() {
    if (hostState?.isBlank) {
      sendCommand({ type: 'UNBLANK' });
    } else {
      sendCommand({ type: 'BLANK_SCREEN' });
    }
  }

  function handleLogo() {
    if (hostState?.isLogo) {
      sendCommand({ type: 'UNBLANK' });
    } else {
      sendCommand({ type: 'SHOW_LOGO' });
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary-600">Close</Text>
        </TouchableOpacity>
        <Text className="font-bold dark:text-white">Live Control</Text>
        <TouchableOpacity onPress={reconnect} className="flex-row items-center gap-2">
          <View
            className={`w-2 h-2 rounded-full ${
              connectionStatus.state === 'connected'
                ? connectionStatus.type === 'local'
                  ? 'bg-green-500'
                  : 'bg-blue-500'
                : connectionStatus.state === 'connecting'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          />
          <Text className="text-sm text-gray-500">
            {connectionStatus.state === 'connected'
              ? connectionStatus.type === 'local'
                ? 'Local'
                : 'Cloud'
              : connectionStatus.state === 'connecting'
              ? 'Connecting'
              : 'Disconnected'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading state */}
      {connectionStatus.state === 'connecting' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-gray-500">Connecting to displays...</Text>
        </View>
      )}

      {/* Disconnected state */}
      {connectionStatus.state === 'disconnected' && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500 mb-4">Not connected</Text>
          <TouchableOpacity
            className="px-6 py-3 bg-primary-600 rounded-lg"
            onPress={reconnect}
          >
            <Text className="text-white font-medium">Reconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connected state */}
      {connectionStatus.state === 'connected' && (
        <>
          {/* Current/Next Preview */}
          <View className="flex-row p-4 gap-4">
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-2">Current</Text>
              <View className="aspect-video bg-black rounded-lg items-center justify-center">
                <Text className="text-gray-400">
                  {hostState?.isBlank
                    ? 'Blank'
                    : hostState?.isLogo
                    ? 'Logo'
                    : `Slide ${(hostState?.currentSlideIndex ?? 0) + 1}`}
                </Text>
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
            <View className="items-center py-8">
              <Text className="text-gray-500">
                Select a song from the service order
              </Text>
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
              className={`px-6 py-4 rounded-lg ${
                hostState?.isBlank ? 'bg-yellow-600' : 'bg-gray-800'
              }`}
              onPress={handleBlank}
            >
              <Text className="text-white font-medium">
                {hostState?.isBlank ? 'Show' : 'Blank'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`px-6 py-4 rounded-lg ${
                hostState?.isLogo ? 'bg-purple-600' : 'bg-gray-600'
              }`}
              onPress={handleLogo}
            >
              <Text className="text-white font-medium">Logo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="px-8 py-4 bg-primary-600 rounded-lg"
              onPress={handleNext}
            >
              <Text className="text-white font-semibold text-lg">Next</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
