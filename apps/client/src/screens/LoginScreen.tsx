import React from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth, useLoginForm } from '@mobileworship/shared';

export function LoginScreen() {
  const { signIn, resetPasswordForEmail } = useAuth();
  const {
    email,
    password,
    error,
    loading,
    authMode,
    emailSent,
    setEmail,
    setPassword,
    setAuthMode,
    resetForm,
    handlePasswordSignIn,
    handleForgotPassword,
  } = useLoginForm();

  const getTitle = () => {
    switch (authMode) {
      case 'forgot-password':
        return 'Reset Password';
      default:
        return 'Mobile Worship';
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center p-6 bg-white dark:bg-gray-900">
          <Text className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            {getTitle()}
          </Text>

          {error ? (
            <View className="mb-4 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
              <Text className="text-red-700 dark:text-red-200 text-center">{error}</Text>
            </View>
          ) : null}

          {authMode === 'password' && (
            <>
              <TextInput
                className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-4 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                placeholder="Email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                placeholder="Password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                onPress={() => setAuthMode('forgot-password')}
                className="mb-6"
              >
                <Text className="text-primary-600 text-right">Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-primary-600 rounded-lg p-4 mb-4"
                onPress={() => handlePasswordSignIn(signIn)}
                disabled={loading}
                style={{ opacity: loading ? 0.5 : 1 }}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  {loading ? 'Signing in...' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {authMode === 'forgot-password' && (
            emailSent ? (
              <View className="items-center">
                <View className="mb-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg w-full">
                  <Text className="text-green-700 dark:text-green-200 text-center">
                    Check your email for a password reset link.
                  </Text>
                </View>
                <TouchableOpacity onPress={resetForm}>
                  <Text className="text-primary-600">Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text className="text-gray-600 dark:text-gray-400 text-center mb-4">
                  Enter your email and we'll send you a link to reset your password.
                </Text>

                <TextInput
                  className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-6 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                  placeholder="Email"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  className="bg-primary-600 rounded-lg p-4 mb-4"
                  onPress={() => handleForgotPassword(resetPasswordForEmail)}
                  disabled={loading}
                  style={{ opacity: loading ? 0.5 : 1 }}
                >
                  <Text className="text-white text-center font-semibold text-lg">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={resetForm} className="items-center">
                  <Text className="text-primary-600">Back to Sign In</Text>
                </TouchableOpacity>
              </>
            )
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
