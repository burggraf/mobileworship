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
  switchChurch: (churchId: string) => Promise<void>;
  hasMultipleChurches: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMultipleChurches, setHasMultipleChurches] = useState(false);
  const isSigningUp = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isSigningUp.current) {
        return;
      }

      if (event === 'SIGNED_IN' && window.location.href.includes('#')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setHasMultipleChurches(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function fetchUserProfile(authUser: User) {
    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError || !userData) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Get memberships
    const { data: memberships } = await supabase
      .from('church_memberships')
      .select('church_id, role, last_accessed_at')
      .eq('user_id', authUser.id)
      .order('last_accessed_at', { ascending: false });

    if (!memberships || memberships.length === 0) {
      // User has no church memberships - edge case
      setUser(null);
      setIsLoading(false);
      return;
    }

    setHasMultipleChurches(memberships.length > 1);

    // Determine current church: use JWT metadata or most recent
    const currentChurchId =
      authUser.user_metadata?.current_church_id || memberships[0].church_id;

    // Find membership for current church
    const currentMembership =
      memberships.find((m) => m.church_id === currentChurchId) || memberships[0];

    // Update JWT metadata if needed
    if (authUser.user_metadata?.current_church_id !== currentMembership.church_id) {
      await supabase.auth.updateUser({
        data: { current_church_id: currentMembership.church_id },
      });
    }

    setUser({
      id: userData.id,
      email: userData.email,
      churchId: currentMembership.church_id,
      role: currentMembership.role as Role,
      name: userData.name,
    });

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
    isSigningUp.current = true;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { current_church_id: null }, // Will be set by create_church_and_user
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_church_and_user', {
        p_user_id: authData.user.id,
        p_church_name: churchName,
        p_user_name: name,
        p_user_email: email,
      });
      if (rpcError) throw rpcError;

      const result = rpcResult as { church_id: string; user_id: string };

      // Update JWT with new church ID
      await supabase.auth.updateUser({
        data: { current_church_id: result.church_id },
      });

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

  async function switchChurch(churchId: string) {
    // Validate membership via RPC
    const { error: validateError } = await supabase.rpc('set_current_church', {
      p_church_id: churchId,
    });
    if (validateError) throw validateError;

    // Update JWT metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: { current_church_id: churchId },
    });
    if (updateError) throw updateError;

    // Refresh user profile
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await fetchUserProfile(authUser);
    }
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
        switchChurch,
        hasMultipleChurches,
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
