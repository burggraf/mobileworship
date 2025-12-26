import { createContext, useContext, useRef, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type SupabaseContextType = {
  supabase: SupabaseClient<Database>;
};

const SupabaseContext = createContext<SupabaseContextType | null>(null);

// Singleton client cache to prevent multiple instances
let cachedClient: SupabaseClient<Database> | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;

function getOrCreateClient(url: string, key: string): SupabaseClient<Database> {
  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }
  cachedClient = createClient<Database>(url, key);
  cachedUrl = url;
  cachedKey = key;
  return cachedClient;
}

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
  const clientRef = useRef<SupabaseClient<Database> | null>(null);

  if (!clientRef.current) {
    clientRef.current = getOrCreateClient(supabaseUrl, supabaseAnonKey);
  }

  return <SupabaseContext.Provider value={{ supabase: clientRef.current }}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context.supabase;
}
