import { useTranslation } from 'react-i18next';
import type { BackgroundSearchResult } from '../../types/backgrounds';
import { SlidePreviewOverlay } from './SlidePreviewOverlay';
import { LoadingSpinner } from '../LoadingSpinner';

interface BackgroundPreviewModalProps {
  background: BackgroundSearchResult | null;
  isOpen: boolean;
  isImporting: boolean;
  onClose: () => void;
  onImport: () => void;
}

export function BackgroundPreviewModal({
  background,
  isOpen,
  isImporting,
  onClose,
  onImport,
}: BackgroundPreviewModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !background) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isImporting) {
      onClose();
    }
  };

  const sourceDisplayName = background.source.charAt(0).toUpperCase() + background.source.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="preview-modal-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isImporting) {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 id="preview-modal-title" className="text-xl font-semibold">
            {t('media.backgrounds.preview')}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Preview with lyrics overlay */}
          <SlidePreviewOverlay backgroundUrl={background.previewUrl} />

          {/* Attribution */}
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {t('media.backgrounds.photoBy', {
              name: background.photographer,
              source: sourceDisplayName,
            })}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isImporting && <LoadingSpinner size="sm" />}
            {isImporting ? t('media.backgrounds.importing') : t('media.backgrounds.import')}
          </button>
        </div>
      </div>
    </div>
  );
}
