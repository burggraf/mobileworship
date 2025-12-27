import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider, AuthProvider } from '@mobileworship/shared';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Config } from './src/config';

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider supabaseUrl={Config.SUPABASE_URL} supabaseAnonKey={Config.SUPABASE_ANON_KEY}>
        <AuthProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
