import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider, AuthProvider } from '@mobileworship/shared';
import { RootNavigator } from './src/navigation/RootNavigator';
import Config from 'react-native-config';

const supabaseUrl = Config.SUPABASE_URL ?? '';
const supabaseAnonKey = Config.SUPABASE_ANON_KEY ?? '';

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
      <SupabaseProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
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
