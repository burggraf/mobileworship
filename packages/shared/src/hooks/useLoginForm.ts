import { useState, useCallback } from 'react';

export type AuthMode = 'password' | 'magic-link' | 'forgot-password';

export interface LoginFormState {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  authMode: AuthMode;
  emailSent: boolean;
}

export interface LoginFormActions {
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setAuthMode: (mode: AuthMode) => void;
  clearError: () => void;
  resetForm: () => void;
}

export interface LoginFormHandlers {
  handlePasswordSignIn: (
    signIn: (email: string, password: string) => Promise<void>,
    onSuccess?: () => void
  ) => Promise<void>;
  handleMagicLink: (
    signInWithMagicLink: (email: string) => Promise<void>
  ) => Promise<void>;
  handleForgotPassword: (
    resetPasswordForEmail: (email: string) => Promise<void>
  ) => Promise<void>;
  handleGoogleSignIn: (
    signInWithGoogle: () => Promise<void>
  ) => Promise<void>;
}

export interface UseLoginFormReturn extends LoginFormState, LoginFormActions, LoginFormHandlers {}

export function useLoginForm(): UseLoginFormReturn {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [emailSent, setEmailSent] = useState(false);

  const clearError = useCallback(() => setError(''), []);

  const resetForm = useCallback(() => {
    setAuthMode('password');
    setEmailSent(false);
    setError('');
  }, []);

  const handlePasswordSignIn = useCallback(
    async (
      signIn: (email: string, password: string) => Promise<void>,
      onSuccess?: () => void
    ) => {
      if (!email || !password) {
        setError('Please enter email and password');
        return;
      }

      setError('');
      setLoading(true);

      try {
        await signIn(email, password);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sign in');
      } finally {
        setLoading(false);
      }
    },
    [email, password]
  );

  const handleMagicLink = useCallback(
    async (signInWithMagicLink: (email: string) => Promise<void>) => {
      if (!email) {
        setError('Please enter your email');
        return;
      }

      setError('');
      setLoading(true);

      try {
        await signInWithMagicLink(email);
        setEmailSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send magic link');
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  const handleForgotPassword = useCallback(
    async (resetPasswordForEmail: (email: string) => Promise<void>) => {
      if (!email) {
        setError('Please enter your email');
        return;
      }

      setError('');
      setLoading(true);

      try {
        await resetPasswordForEmail(email);
        setEmailSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send reset email');
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  const handleGoogleSignIn = useCallback(
    async (signInWithGoogle: () => Promise<void>) => {
      setError('');
      setLoading(true);

      try {
        await signInWithGoogle();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
        setLoading(false);
      }
    },
    []
  );

  return {
    // State
    email,
    password,
    error,
    loading,
    authMode,
    emailSent,
    // Actions
    setEmail,
    setPassword,
    setAuthMode,
    clearError,
    resetForm,
    // Handlers
    handlePasswordSignIn,
    handleMagicLink,
    handleForgotPassword,
    handleGoogleSignIn,
  };
}
