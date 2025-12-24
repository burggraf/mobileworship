import { useTranslation } from 'react-i18next';
import { useMedia } from '@mobileworship/shared';

interface MediaPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mediaId: string | null) => void;
  selectedId?: string;
}

export function MediaPicker({ isOpen, onClose, onSelect, selectedId }: MediaPickerProps) {
  const { t } = useTranslation();
  const { media, isLoading, getPublicUrl } = useMedia();

  if (!isOpen) return null;

  const handleMediaClick = (mediaId: string) => {
    onSelect(mediaId);
  };

  const handleMediaDoubleClick = (mediaId: string) => {
    onSelect(mediaId);
    onClose();
  };

  const handleConfirm = () => {
    onClose();
  };

  const handleRemoveBackground = () => {
    onSelect(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="media-picker-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 id="media-picker-title" className="text-xl font-semibold">
            {t('media.picker.title')}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg
                  className="animate-spin h-8 w-8 mx-auto mb-2 text-primary-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
              </div>
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-2">{t('media.picker.noMedia')}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {t('media.picker.uploadHint')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {/* None Option */}
              <button
                onClick={handleRemoveBackground}
                className={`
                  relative aspect-video rounded-lg border-2 transition-all
                  flex items-center justify-center
                  ${selectedId === null || selectedId === undefined
                    ? 'ring-2 ring-primary-500 border-primary-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-400'
                  }
                  bg-gray-100 dark:bg-gray-900
                `}
                title="No background"
              >
                <div className="text-center">
                  <svg
                    className="h-8 w-8 mx-auto mb-1 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('media.picker.none')}</span>
                </div>
              </button>

              {/* Media Items */}
              {media.map((item) => {
                const isSelected = selectedId === item.id;
                const publicUrl = getPublicUrl(item.storage_path);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleMediaClick(item.id)}
                    onDoubleClick={() => handleMediaDoubleClick(item.id)}
                    className={`
                      relative aspect-video rounded-lg border-2 transition-all overflow-hidden
                      ${isSelected
                        ? 'ring-2 ring-primary-500 border-primary-500'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-400'
                      }
                    `}
                    title={`Select ${item.type}`}
                  >
                    {item.type === 'image' ? (
                      <img
                        src={publicUrl}
                        alt="Background option"
                        className="w-full h-full object-cover"
                      />
                    ) : item.type === 'video' ? (
                      <div className="relative w-full h-full bg-gray-900">
                        <video
                          src={publicUrl}
                          className="w-full h-full object-cover"
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <svg
                            className="h-12 w-12 text-white opacity-80"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    ) : null}

                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-1">
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            {t('media.picker.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            {t('media.picker.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
