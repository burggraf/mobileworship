import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { useSupabase } from './useSupabase';
import type { Role, Permission } from '../types';
import { hasPermission } from '../types';

interface AuthUser {
  id: string;
  email: string;
  churchId: string;
  role: Role;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, churchName: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function fetchUserProfile(authUser: User) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error || !data) {
      setUser(null);
    } else {
      setUser({
        id: data.id,
        email: data.email,
        churchId: data.church_id,
        role: data.role as Role,
        name: data.name,
      });
    }
    setIsLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, name: string, churchName: string) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // Create church
    const { data: church, error: churchError } = await supabase
      .from('churches')
      .insert({ name: churchName })
      .select()
      .single();
    if (churchError) throw churchError;

    // Create user profile
    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user.id,
      church_id: church.id,
      role: 'admin',
      name,
      email,
    });
    if (profileError) throw profileError;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  function can(permission: Permission): boolean {
    if (!user) return false;
    return hasPermission(user.role, permission);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
