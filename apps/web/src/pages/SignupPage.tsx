import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useSupabase } from '@mobileworship/shared';

export function SignupPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const supabase = useSupabase();
  const redirectUrl = searchParams.get('redirect');

  // Check if this is an invitation signup (redirect to accept-invite)
  const isInvitationSignup = redirectUrl?.includes('/accept-invite');

  const [name, setName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [email, setEmail] = useState('');
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  // Fetch invitation details to pre-fill email for invitation signups
  useEffect(() => {
    async function fetchInvitation() {
      if (!isInvitationSignup || !redirectUrl) return;

      // Extract token from redirect URL (e.g., /accept-invite?token=xxx)
      const tokenMatch = redirectUrl.match(/token=([^&]+)/);
      if (!tokenMatch) return;

      const token = tokenMatch[1];

      try {
        // Only fetch email - church name requires auth due to RLS
        const { data } = await supabase
          .from('invitations')
          .select('email')
          .eq('token', token)
          .single();

        if (data?.email) {
          setInvitationEmail(data.email);
          setEmail(data.email);
        }
      } catch (err) {
        console.error('Failed to fetch invitation:', err);
      }
    }

    fetchInvitation();
  }, [isInvitationSignup, redirectUrl, supabase]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const { signUp, signUpForInvitation } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isInvitationSignup && redirectUrl) {
        // Signing up to accept an invitation - no church needed
        await signUpForInvitation(email, password, name, redirectUrl);
      } else {
        // Regular signup - create user and church
        await signUp(email, password, name, churchName);
      }
      setSignupComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  if (signupComplete) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4">{t('auth.signup.checkEmail.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('auth.signup.checkEmail.description', { email })}
          </p>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg mb-6">
            {t('auth.signup.checkEmail.hint')}
          </div>
          <Link
            to="/login"
            className="text-primary-600 hover:underline"
          >
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-4 text-center">{t('auth.createAccount')}</h1>

        {isInvitationSignup && (
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            {t('auth.invitationSignup', 'Create an account to accept your invitation.')}
          </p>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              {t('auth.name')}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          {!isInvitationSignup && (
            <div>
              <label htmlFor="churchName" className="block text-sm font-medium mb-1">
                {t('auth.churchName')}
              </label>
              <input
                id="churchName"
                type="text"
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => !invitationEmail && setEmail(e.target.value)}
              readOnly={!!invitationEmail}
              required
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 ${
                invitationEmail ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
              }`}
            />
            {invitationEmail && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('auth.emailLockedForInvitation', 'This email is set by your invitation and cannot be changed.')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? t('auth.signingUp') : t('auth.createAccount')}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-primary-600 hover:underline">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </main>
  );
}
