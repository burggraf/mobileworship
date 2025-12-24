import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@mobileworship/shared';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center p-6 bg-white dark:bg-gray-900">
      <Text className="text-3xl font-bold text-center mb-8 dark:text-white">Mobile Worship</Text>

      <TextInput
        className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-4 dark:text-white"
        placeholder="Email"
        placeholderTextColor="#9ca3af"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-6 dark:text-white"
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        className="bg-primary-600 rounded-lg p-4"
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text className="text-white text-center font-semibold">
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
