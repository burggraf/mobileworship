import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useSupabase } from '@mobileworship/shared';
import { useTheme } from '../contexts/ThemeContext';
import { supportedLanguages } from '../i18n';
import { TeamSection } from '../components/settings/TeamSection';
import { ChurchSwitcher } from '../components/settings/ChurchSwitcher';
import { DeleteChurchSection } from '../components/settings/DeleteChurchSection';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, can, hasMultipleChurches } = useAuth();
  const supabase = useSupabase();
  const { theme, setTheme } = useTheme();
  const [churchName, setChurchName] = useState('');
  const [ccliNumber, setCcliNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch church data on mount
  useEffect(() => {
    if (user?.churchId) {
      supabase
        .from('churches')
        .select('name, ccli_license_number')
        .eq('id', user.churchId)
        .single()
        .then(({ data }) => {
          if (data) {
            setChurchName(data.name);
            setCcliNumber(data.ccli_license_number || '');
          }
        });
    }
  }, [user?.churchId, supabase]);

  // Save church settings
  async function handleSaveChurch() {
    if (!user?.churchId) return;

    setIsSaving(true);
    try {
      await supabase
        .from('churches')
        .update({
          name: churchName,
          ccli_license_number: ccliNumber || null
        })
        .eq('id', user.churchId);
    } finally {
      setIsSaving(false);
    }
  }

  function handleLanguageChange(langCode: string) {
    i18n.changeLanguage(langCode);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('settings.title')}</h2>

      <div className="space-y-8">
        {/* Appearance Section - Theme & Language */}
        <section>
          <h3 className="text-lg font-semibold mb-4">{t('settings.appearance.title')}</h3>
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-4">
            {/* Theme Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.appearance.theme')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-4 py-2 rounded-lg border transition ${
                    theme === 'light'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    {t('settings.appearance.light')}
                  </span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-4 py-2 rounded-lg border transition ${
                    theme === 'dark'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    {t('settings.appearance.dark')}
                  </span>
                </button>
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.appearance.language')}</label>
              <select
                value={i18n.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Profile Section */}
        <section>
          <h3 className="text-lg font-semibold mb-4">{t('settings.profile.title')}</h3>
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">{t('settings.profile.name')}</label>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">{t('settings.profile.email')}</label>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">{t('settings.profile.role')}</label>
              <p className="font-medium capitalize">{user?.role}</p>
            </div>
          </div>
        </section>

        {can('church:manage') && (
          <section>
            <h3 className="text-lg font-semibold mb-4">{t('settings.church.title')}</h3>
            <div className="p-4 border dark:border-gray-700 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.church.name')}</label>
                <input
                  type="text"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.church.ccli')}</label>
                <input
                  type="text"
                  value={ccliNumber}
                  onChange={(e) => setCcliNumber(e.target.value)}
                  placeholder={t('settings.church.ccliPlaceholder')}
                  className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                />
              </div>
              <button
                onClick={handleSaveChurch}
                disabled={isSaving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? t('settings.church.saving') : t('settings.church.save')}
              </button>
            </div>
          </section>
        )}

        {can('church:manage') && (
          <section>
            <h3 className="text-lg font-semibold mb-4">{t('settings.billing.title')}</h3>
            <div className="p-4 border dark:border-gray-700 rounded-lg">
              <p className="text-gray-500">{t('settings.billing.comingSoon')}</p>
            </div>
          </section>
        )}

        {can('integrations:manage') && (
          <section>
            <h3 className="text-lg font-semibold mb-4">{t('settings.integrations.title')}</h3>
            <div className="p-4 border dark:border-gray-700 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{t('settings.integrations.ccli.name')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.integrations.ccli.description')}
                  </p>
                </div>
                <button className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  {t('settings.integrations.connect')}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{t('settings.integrations.planningCenter.name')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.integrations.planningCenter.description')}
                  </p>
                </div>
                <button className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  {t('settings.integrations.connect')}
                </button>
              </div>
            </div>
          </section>
        )}

        {can('church:users') && <TeamSection />}

        {hasMultipleChurches && <ChurchSwitcher />}

        {can('church:manage') && <DeleteChurchSection />}
      </div>
    </div>
  );
}
