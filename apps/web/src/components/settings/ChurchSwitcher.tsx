import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useMemberships } from '@mobileworship/shared';

export function ChurchSwitcher() {
  const { t } = useTranslation();
  const { user, switchChurch } = useAuth();
  const { myMemberships, isLoadingMyMemberships } = useMemberships();
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = async (churchId: string) => {
    try {
      setError(null);
      setIsSwitching(churchId);
      await switchChurch(churchId);
      // Reload page to refresh all queries with new church context
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch church:', err);
      setError(t('settings.churchSwitcher.switchFailed'));
      setIsSwitching(null);
    }
  };

  if (isLoadingMyMemberships) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('settings.churchSwitcher.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">{t('app.loading')}</p>
      </div>
    );
  }

  if (myMemberships.length <= 1) {
    return null; // Don't show switcher if user only has one church
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('settings.churchSwitcher.title')}
      </h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {myMemberships.map((membership) => {
          const isCurrent = membership.churchId === user?.churchId;
          const isLoading = isSwitching === membership.churchId;

          return (
            <div
              key={membership.id}
              className={`rounded-lg border p-4 ${
                isCurrent
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {membership.church?.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(`settings.team.roles.${membership.role}`)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {isCurrent ? (
                    <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                      {t('settings.churchSwitcher.currentChurch')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSwitch(membership.churchId)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading
                        ? t('settings.churchSwitcher.switching')
                        : t('settings.churchSwitcher.switch')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
