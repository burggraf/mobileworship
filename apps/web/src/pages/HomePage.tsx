import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">{t('home.hero.title')}</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 text-center max-w-2xl">
        {t('home.hero.subtitle')}
      </p>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          {t('auth.signIn')}
        </Link>
        <Link
          to="/signup"
          className="px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950 transition"
        >
          {t('home.hero.cta')}
        </Link>
      </div>
    </main>
  );
}
