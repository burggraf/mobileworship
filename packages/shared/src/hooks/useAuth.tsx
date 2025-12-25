import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
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
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, churchName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track when we're in the middle of signup to prevent race condition
  const isSigningUp = useRef(false);

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip profile fetch if we're in the middle of signup
      if (isSigningUp.current) {
        return;
      }

      // Clean up URL hash after auth callback (removes trailing #)
      if (event === 'SIGNED_IN' && window.location.href.includes('#')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

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

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
  }

  async function signInWithMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, name: string, churchName: string) {
    // Prevent onAuthStateChange from fetching profile during signup
    isSigningUp.current = true;

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Create church and user profile atomically via RPC (bypasses RLS)
      const { error: rpcError } = await supabase.rpc('create_church_and_user', {
        p_user_id: authData.user.id,
        p_church_name: churchName,
        p_user_name: name,
        p_user_email: email,
      });
      if (rpcError) throw rpcError;

      // Now fetch the profile since everything is set up
      await fetchUserProfile(authData.user);
    } finally {
      isSigningUp.current = false;
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function resetPasswordForEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  function can(permission: Permission): boolean {
    if (!user) return false;
    return hasPermission(user.role, permission);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signInWithGoogle,
        signInWithMagicLink,
        signUp,
        signOut,
        resetPasswordForEmail,
        updatePassword,
        can,
      }}
    >
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
