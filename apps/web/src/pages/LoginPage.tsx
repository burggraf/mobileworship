import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@mobileworship/shared';

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { signIn, resetPasswordForEmail } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPasswordForEmail(email);
      setResetEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    setShowForgotPassword(false);
    setResetEmailSent(false);
    setError('');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-center">
          {showForgotPassword ? t('auth.forgotPassword.title') : t('auth.signIn')}
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {showForgotPassword ? (
          resetEmailSent ? (
            <div className="text-center">
              <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-lg">
                {t('auth.forgotPassword.emailSent')}
              </div>
              <button
                onClick={handleBackToLogin}
                className="text-primary-600 hover:underline"
              >
                {t('auth.forgotPassword.backToLogin')}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-4 text-gray-600 dark:text-gray-400 text-center">
                {t('auth.forgotPassword.description')}
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    {t('auth.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {loading ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.sendLink')}
                </button>
              </form>

              <p className="mt-6 text-center">
                <button
                  onClick={handleBackToLogin}
                  className="text-primary-600 hover:underline"
                >
                  {t('auth.forgotPassword.backToLogin')}
                </button>
              </p>
            </>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-sm font-medium">
                    {t('auth.password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    {t('auth.forgotPassword.link')}
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </form>

            <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
              {t('auth.noAccount')}{' '}
              <Link to="/signup" className="text-primary-600 hover:underline">
                {t('auth.signUp')}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
