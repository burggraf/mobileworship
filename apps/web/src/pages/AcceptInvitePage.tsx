import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations, useSupabase } from '@mobileworship/shared';
import { getInvitationStatus, type Invitation } from '@mobileworship/shared';
import { PageLoading } from '../components/LoadingSpinner';
import type { User as AuthUser } from '@supabase/supabase-js';

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const supabase = useSupabase();
  const { acceptInvitation, getInvitationByToken } = useInvitations();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [userName, setUserName] = useState('');
  // Store the raw auth user (not the enriched useAuth user which requires membership)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setError(t('invite.notFound'));
        setIsLoading(false);
        return;
      }

      // Check raw auth session - don't use useAuth which requires church membership
      // Invited users may not have a membership yet, but they ARE authenticated
      const { data: { user: sessionUser } } = await supabase.auth.getUser();

      if (!sessionUser) {
        // Not authenticated - check if invited user already has an account
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: userExists } = await (supabase.rpc as any)('check_invitation_user_exists', {
          p_token: token
        });

        const redirectParam = encodeURIComponent(`/accept-invite?token=${token}`);
        if (userExists) {
          // User has account - go to login
          navigate(`/login?redirect=${redirectParam}`);
        } else {
          // New user - go directly to signup
          navigate(`/signup?redirect=${redirectParam}`);
        }
        return;
      }

      setAuthUser(sessionUser);

      try {
        const inviteData = await getInvitationByToken(token);

        if (!inviteData) {
          setError(t('invite.notFound'));
          setIsLoading(false);
          return;
        }

        setInvitation(inviteData);

        // Check status
        const status = getInvitationStatus(inviteData);
        if (status === 'expired') {
          setError(t('invite.expired'));
          setIsLoading(false);
          return;
        }
        if (status === 'accepted') {
          // Already accepted, redirect to dashboard
          navigate('/dashboard');
          return;
        }

        // Check if user email matches invitation email
        if (sessionUser.email !== inviteData.email) {
          setError(t('invite.emailMismatch'));
          setIsLoading(false);
          return;
        }

        // Check if user needs to create profile record
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', sessionUser.id)
          .maybeSingle();

        if (!existingUser) {
          setNeedsProfile(true);
          // Pre-fill name from user metadata if available (from invitation signup)
          const nameFromMetadata = sessionUser.user_metadata?.name;
          if (nameFromMetadata) {
            setUserName(nameFromMetadata);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load invitation:', err);
        setError(t('invite.notFound'));
        setIsLoading(false);
      }
    }

    loadInvitation();
  }, [token, navigate, getInvitationByToken, supabase, t]);

  async function handleAccept() {
    if (!token || !invitation || !authUser) return;

    // Validate name if needed
    if (needsProfile && !userName.trim()) {
      setError(t('auth.name') + ' is required');
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      // Create user profile if needed
      if (needsProfile) {
        if (!authUser.email) {
          throw new Error('User email is required');
        }
        await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email,
            name: userName.trim(),
          });
      }

      // Accept invitation
      const result = await acceptInvitation(token);

      // Update JWT with current church and refresh session
      await supabase.auth.updateUser({
        data: { current_church_id: result.church_id },
      });
      await supabase.auth.refreshSession();

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setError(err instanceof Error ? err.message : t('invite.acceptFailed'));
      setIsAccepting(false);
    }
  }

  // Loading state
  if (isLoading) {
    return <PageLoading />;
  }

  // Error state
  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <svg
              className="h-16 w-16 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            {error}
          </h1>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            {t('auth.signIn')}
          </button>
        </div>
      </main>
    );
  }

  // Success state - show invitation
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <svg
            className="h-20 w-20 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold mb-4 text-center text-gray-900 dark:text-white">
          {t('invite.title')}
        </h1>

        {invitation && (
          <p className="mb-8 text-center text-gray-600 dark:text-gray-400">
            {t('invite.description', {
              churchName: invitation.church?.name || 'Unknown Church',
              role: t(`settings.team.roles.${invitation.role}`),
            })}
          </p>
        )}

        {needsProfile && (
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              {t('auth.name')}
            </label>
            <input
              id="name"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t('auth.name')}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={isAccepting || (needsProfile && !userName.trim())}
          className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
        >
          {isAccepting ? t('invite.accepting') : t('invite.accept')}
        </button>
      </div>
    </main>
  );
}
