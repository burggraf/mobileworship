// apps/client/src/screens/displays/NameDisplayScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useSupabase, useAuth } from '@mobileworship/shared';
import { claimDisplay } from '@mobileworship/shared';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;
type RouteType = RouteProp<DisplaysStackParamList, 'NameDisplay'>;

export function NameDisplayScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { code } = route.params;
  const supabase = useSupabase();
  const { session } = useAuth();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a name for this display');
      return;
    }

    if (!session?.access_token) {
      setError('Not authenticated');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = (supabase as any).supabaseUrl || process.env.SUPABASE_URL;

      await claimDisplay(
        supabaseUrl,
        session.access_token,
        code,
        name.trim(),
        location.trim() || undefined
      );

      Alert.alert('Success', 'Display paired successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('DisplaysList'),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pair display';
      if (message.includes('Invalid') || message.includes('expired')) {
        setError('Code not found or expired. Check the display and try again.');
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-900"
    >
      <View className="flex-1 p-6">
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full items-center justify-center mb-4">
            <Text className="text-green-600 dark:text-green-400 text-2xl">✓</Text>
          </View>
          <Text className="text-xl font-semibold text-gray-900 dark:text-white">
            Display Found!
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name *
          </Text>
          <TextInput
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
            placeholder="e.g., Main Sanctuary"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            autoFocus
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Location (optional)
          </Text>
          <TextInput
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
            placeholder="e.g., Building A"
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {error && (
          <Text className="text-red-500 text-center mb-4">{error}</Text>
        )}

        <TouchableOpacity
          className={`py-4 rounded-lg ${
            name.trim() && !isSubmitting
              ? 'bg-blue-500'
              : 'bg-gray-300 dark:bg-gray-700'
          }`}
          onPress={handleSubmit}
          disabled={!name.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              Complete Setup
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
