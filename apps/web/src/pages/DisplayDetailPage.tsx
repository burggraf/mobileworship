import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDisplay, useAuth, isDisplayOnline } from '@mobileworship/shared';
import type { DisplaySettings } from '@mobileworship/shared';

export function DisplayDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { display, isLoading, updateSettings, updateName, remove, testConnection } = useDisplay(id ?? null);
  const { can } = useAuth();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [, setTick] = useState(0);

  // Re-evaluate online status every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Settings state
  const [fontSize, setFontSize] = useState<DisplaySettings['fontSize']>('medium');
  const [textPosition, setTextPosition] = useState<DisplaySettings['textPosition']>('center');
  const [fontFamily, setFontFamily] = useState<DisplaySettings['fontFamily']>('system');
  const [textShadow, setTextShadow] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  useEffect(() => {
    if (display) {
      setName(display.name);
      setLocation(display.location || '');
      setFontSize(display.settings?.fontSize || 'medium');
      setTextPosition(display.settings?.textPosition || 'center');
      setFontFamily(display.settings?.fontFamily || 'system');
      setTextShadow(display.settings?.textShadow ?? true);
      setOverlayOpacity(display.settings?.overlayOpacity ?? 0.5);
      setHasChanges(false);
    }
  }, [display]);

  useEffect(() => {
    if (!display) return;
    const nameChanged = name !== display.name;
    const locationChanged = location !== (display.location || '');
    const fontSizeChanged = fontSize !== (display.settings?.fontSize || 'medium');
    const textPositionChanged = textPosition !== (display.settings?.textPosition || 'center');
    const fontFamilyChanged = fontFamily !== (display.settings?.fontFamily || 'system');
    const textShadowChanged = textShadow !== (display.settings?.textShadow ?? true);
    const overlayChanged = overlayOpacity !== (display.settings?.overlayOpacity ?? 0.5);
    setHasChanges(
      nameChanged || locationChanged || fontSizeChanged || textPositionChanged ||
      fontFamilyChanged || textShadowChanged || overlayChanged
    );
  }, [name, location, fontSize, textPosition, fontFamily, textShadow, overlayOpacity, display]);

  if (isLoading) {
    return <div className="text-gray-500">{t('common.loading')}</div>;
  }

  if (!display) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{t('displays.notFound')}</p>
        <Link
          to="/dashboard/displays"
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          {t('displays.backToDisplays')}
        </Link>
      </div>
    );
  }

  const online = isDisplayOnline(display.lastSeenAt);
  const canEdit = can('church:manage');
  const isSaving = updateName.isPending || updateSettings.isPending;
  const isDeleting = remove.isPending;

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('displays.edit.nameRequired'));
      return;
    }
    setError(null);

    try {
      await updateName.mutateAsync({ name: name.trim(), location: location.trim() || undefined });
      await updateSettings.mutateAsync({
        fontSize,
        textPosition,
        fontFamily,
        textShadow,
        overlayOpacity,
      });
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('displays.edit.saveFailed'));
    }
  };

  const handleRemove = async () => {
    const confirmed = window.confirm(t('displays.edit.removeConfirm', { name: display.name }));
    if (!confirmed) return;

    try {
      await remove.mutateAsync();
      navigate('/dashboard/displays');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('displays.edit.removeFailed'));
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult(result);
    setIsTesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard/displays"
          className="text-primary-600 hover:text-primary-700 hover:underline text-sm mb-4 inline-block"
        >
          &larr; {t('displays.backToDisplays')}
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{t('displays.edit.title')}</h2>
            <span className={`px-2 py-1 text-xs rounded ${
              online
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {online ? t('displays.online') : t('displays.offline')}
            </span>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={handleRemove}
                disabled={isDeleting || isSaving}
                className="px-4 py-2 border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
              >
                {isDeleting ? t('displays.edit.removing') : t('displays.edit.remove')}
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || isDeleting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <div className="border dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">{t('displays.edit.basicInfo')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('displays.edit.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || isSaving}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('displays.edit.location')}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!canEdit || isSaving}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
              placeholder={t('displays.edit.locationPlaceholder')}
            />
          </div>
        </div>
      </div>

      {/* Device Info */}
      {display.deviceInfo && (
        <div className="border dark:border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('displays.edit.deviceInfo')}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('displays.edit.platform')}</span>
              <p className="font-medium">{display.deviceInfo.platform}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('displays.edit.resolution')}</span>
              <p className="font-medium">
                {display.deviceInfo.resolution.width}x{display.deviceInfo.resolution.height}
              </p>
            </div>
            {display.deviceInfo.version && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">{t('displays.edit.appVersion')}</span>
                <p className="font-medium">{display.deviceInfo.version}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Display Settings */}
      <div className="border dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">{t('displays.edit.displaySettings')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('displays.edit.fontSize')}</label>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as DisplaySettings['fontSize'])}
              disabled={!canEdit || isSaving}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            >
              <option value="small">{t('displays.edit.fontSizes.small')}</option>
              <option value="medium">{t('displays.edit.fontSizes.medium')}</option>
              <option value="large">{t('displays.edit.fontSizes.large')}</option>
              <option value="xlarge">{t('displays.edit.fontSizes.xlarge')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('displays.edit.textPosition')}</label>
            <select
              value={textPosition}
              onChange={(e) => setTextPosition(e.target.value as DisplaySettings['textPosition'])}
              disabled={!canEdit || isSaving}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            >
              <option value="center">{t('displays.edit.positions.center')}</option>
              <option value="bottom">{t('displays.edit.positions.bottom')}</option>
              <option value="lower-third">{t('displays.edit.positions.lowerThird')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('displays.edit.fontFamily')}</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as DisplaySettings['fontFamily'])}
              disabled={!canEdit || isSaving}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            >
              <option value="system">{t('displays.edit.fonts.system')}</option>
              <option value="serif">{t('displays.edit.fonts.serif')}</option>
              <option value="sans-serif">{t('displays.edit.fonts.sansSerif')}</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('displays.edit.textShadow')}</label>
            <button
              onClick={() => setTextShadow(!textShadow)}
              disabled={!canEdit || isSaving}
              className={`w-12 h-6 rounded-full transition ${
                textShadow ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
              } disabled:opacity-50`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition ${
                textShadow ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('displays.edit.overlayOpacity')} ({Math.round(overlayOpacity * 100)}%)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              disabled={!canEdit || isSaving}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Connection Test */}
      <div className="border dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">{t('displays.edit.connection')}</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            {isTesting ? t('displays.edit.testing') : t('displays.edit.testConnection')}
          </button>
          {testResult !== null && (
            <span className={testResult ? 'text-green-600' : 'text-red-600'}>
              {testResult ? t('displays.edit.connectionSuccess') : t('displays.edit.connectionFailed')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
