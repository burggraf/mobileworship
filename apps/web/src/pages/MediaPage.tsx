import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedia, useAuth } from '@mobileworship/shared';
import { FreeBackgroundsTab } from '../components/backgrounds';

type MediaTab = 'myMedia' | 'freeBackgrounds';

export function MediaPage() {
  const { t } = useTranslation();
  const { media, isLoading, uploadMedia, deleteMedia, getPublicUrl } = useMedia();
  const { can } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<MediaTab>('myMedia');

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      await uploadMedia.mutateAsync({ file, type });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  const handleImportSuccess = () => {
    // Switch to My Media tab to show the imported background
    setActiveTab('myMedia');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('media.title')}</h2>
        {can('media:write') && activeTab === 'myMedia' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {uploading ? t('media.uploading') : t('media.upload')}
            </button>
          </>
        )}
      </div>

      {/* Tab Bar - only show tabs if user can write (import backgrounds) */}
      {can('media:write') && (
        <div className="border-b dark:border-gray-700 mb-6">
          <nav className="flex gap-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('myMedia')}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === 'myMedia'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              {t('media.tabs.myMedia')}
            </button>
            <button
              onClick={() => setActiveTab('freeBackgrounds')}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === 'freeBackgrounds'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              {t('media.tabs.freeBackgrounds')}
            </button>
          </nav>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'myMedia' || !can('media:write') ? (
        isLoading ? (
          <div className="text-gray-500">{t('common.loading')}</div>
        ) : media.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>{t('media.noMedia')}</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group"
              >
                {item.type === 'image' ? (
                  <img
                    src={getPublicUrl(item.storage_path)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video src={getPublicUrl(item.storage_path)} className="w-full h-full object-cover" />
                )}
                {can('media:write') && (
                  <button
                    onClick={() => deleteMedia.mutate(item.id)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition"
                  >
                    {t('media.delete')}
                  </button>
                )}
                <div className="absolute bottom-2 left-2 flex gap-1">
                  <span className="px-2 py-0.5 text-xs bg-black/50 text-white rounded">
                    {t(`media.${item.type}`)}
                  </span>
                  {item.source && item.source !== 'upload' && (
                    <span className="px-2 py-0.5 text-xs bg-black/50 text-white rounded capitalize">
                      {item.source}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <FreeBackgroundsTab onImportSuccess={handleImportSuccess} />
      )}
    </div>
  );
}
