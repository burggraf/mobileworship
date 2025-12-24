import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type SupabaseContextType = {
  supabase: SupabaseClient<Database>;
};

const SupabaseContext = createContext<SupabaseContextType | null>(null);

interface SupabaseProviderProps {
  children: ReactNode;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function SupabaseProvider({
  children,
  supabaseUrl,
  supabaseAnonKey,
}: SupabaseProviderProps) {
  const supabase = useMemo(
    () => createClient<Database>(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey]
  );

  return <SupabaseContext.Provider value={{ supabase }}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context.supabase;
}
