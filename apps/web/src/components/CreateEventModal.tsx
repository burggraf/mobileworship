import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvents } from '@mobileworship/shared';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateEventModal({ isOpen, onClose }: CreateEventModalProps) {
  const { t } = useTranslation();
  const { createEvent } = useEvents();
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<'draft' | 'ready'>('draft');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) {
      setError(t('events.create.titleRequired'));
      return;
    }

    try {
      // Create the event
      await createEvent.mutateAsync({
        title: title.trim(),
        scheduledAt: scheduledAt || undefined,
        items: [],
      });

      // Reset form and close modal on success
      setTitle('');
      setScheduledAt('');
      setStatus('draft');
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('events.create.failed'));
    }
  };

  const handleClose = () => {
    if (!createEvent.isPending) {
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="modal-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !createEvent.isPending) {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 id="modal-title" className="text-xl font-semibold">{t('events.create.title')}</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Title Field */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium mb-1"
              >
                {t('events.create.eventTitle')} <span className="text-red-500">{t('common.required')}</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={createEvent.isPending}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
                placeholder={t('events.create.titlePlaceholder')}
                autoFocus
              />
            </div>

            {/* Scheduled Date/Time Field */}
            <div>
              <label
                htmlFor="scheduledAt"
                className="block text-sm font-medium mb-1"
              >
                {t('events.create.scheduledAt')}
              </label>
              <input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={createEvent.isPending}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('events.create.scheduledHint')}
              </p>
            </div>

            {/* Status Field */}
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium mb-1"
              >
                {t('events.create.status')}
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'ready')}
                disabled={createEvent.isPending}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
              >
                <option value="draft">{t('events.status.draft')}</option>
                <option value="ready">{t('events.status.ready')}</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('events.create.statusHint')}
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Footer with Buttons */}
          <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={createEvent.isPending}
              className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('events.create.cancel')}
            </button>
            <button
              type="submit"
              disabled={createEvent.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createEvent.isPending ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
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
                  {t('events.create.creating')}
                </>
              ) : (
                t('events.create.create')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
