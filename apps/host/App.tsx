import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider, AuthProvider } from '@mobileworship/shared';
import { DisplayScreen } from './src/screens/DisplayScreen';
import Config from 'react-native-config';
import KeepAwake from 'react-native-keep-awake';

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
          <KeepAwake />
          <DisplayScreen />
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
