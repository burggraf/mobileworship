// apps/client/src/screens/displays/AddDisplayScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;

export function AddDisplayScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [mode, setMode] = useState<'scan' | 'manual'>('manual'); // Start with manual for now
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const fullCode = code.join('');
  const isComplete = fullCode.length === 6;

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];

    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split('');
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setError(null);
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) return;
    setIsValidating(true);
    setError(null);

    // Navigate to name screen with the code
    // The actual validation happens there when claiming
    navigation.navigate('NameDisplay', { code: fullCode });
    setIsValidating(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-900"
    >
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Enter Display Code
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-8">
          Enter the 6-digit code shown on your display
        </Text>

        <View className="flex-row gap-2 mb-6">
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              className="w-12 h-14 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-center text-2xl font-bold text-gray-900 dark:text-white"
              value={digit}
              onChangeText={(value) => handleDigitChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </View>

        {error && (
          <Text className="text-red-500 text-center mb-4">{error}</Text>
        )}

        <TouchableOpacity
          className={`w-full py-4 rounded-lg ${
            isComplete && !isValidating
              ? 'bg-blue-500'
              : 'bg-gray-300 dark:bg-gray-700'
          }`}
          onPress={handleSubmit}
          disabled={!isComplete || isValidating}
        >
          {isValidating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              Connect Display
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
