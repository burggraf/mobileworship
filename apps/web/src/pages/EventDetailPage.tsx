import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEvents, useSongs, useAuth } from '@mobileworship/shared';
import type { EventItem } from '@mobileworship/shared';
import { ServiceOrderEditor } from '../components/ServiceOrderEditor';

export function EventDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { events, updateEvent, deleteEvent } = useEvents();
  const { songs } = useSongs();
  const { can } = useAuth();

  // Find the event
  const event = events.find((e) => e.id === id);

  // Local state for editing
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<'draft' | 'ready' | 'live' | 'completed'>('draft');
  const [items, setItems] = useState<EventItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize state when event loads
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setScheduledAt(
        event.scheduled_at ? new Date(event.scheduled_at).toISOString().slice(0, 16) : ''
      );
      setStatus((event.status as 'draft' | 'ready' | 'live' | 'completed') || 'draft');
      setItems((event.items as unknown as EventItem[]) || []);
      setHasChanges(false);
    }
  }, [event]);

  // Track changes
  useEffect(() => {
    if (!event) return;
    const titleChanged = title !== event.title;
    const scheduledAtChanged =
      scheduledAt !== (event.scheduled_at ? new Date(event.scheduled_at).toISOString().slice(0, 16) : '');
    const statusChanged = status !== (event.status || 'draft');
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(event.items || []);
    setHasChanges(titleChanged || scheduledAtChanged || statusChanged || itemsChanged);
  }, [title, scheduledAt, status, items, event]);

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{t('events.notFound')}</p>
        <Link
          to="/dashboard/events"
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          {t('events.backToEvents')}
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;
    setError(null);

    // Validation
    if (!title.trim()) {
      setError(t('events.edit.titleRequired'));
      return;
    }

    try {
      await updateEvent.mutateAsync({
        id,
        title: title.trim(),
        scheduledAt: scheduledAt || undefined,
        items,
        status,
      });
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('events.edit.saveFailed'));
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    const confirmed = window.confirm(t('events.edit.deleteConfirm', { title: event.title }));

    if (!confirmed) return;

    try {
      await deleteEvent.mutateAsync(id);
      navigate('/dashboard/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('events.edit.deleteFailed'));
    }
  };

  const canEdit = can('events:write');
  const isSaving = updateEvent.isPending;
  const isDeleting = deleteEvent.isPending;

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    live: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    completed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard/events"
          className="text-primary-600 hover:text-primary-700 hover:underline text-sm mb-4 inline-block"
        >
          &larr; {t('events.backToEvents')}
        </Link>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('events.edit.title')}</h2>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="px-4 py-2 border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? t('events.edit.deleting') : t('events.edit.delete')}
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || isDeleting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? t('events.edit.saving') : t('events.edit.save')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Event Form */}
      <div className="space-y-6">
        {/* Title Field */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            {t('events.create.eventTitle')} <span className="text-red-500">{t('common.required')}</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit || isSaving || isDeleting}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={t('events.edit.titlePlaceholder')}
          />
        </div>

        {/* Scheduled Date Field */}
        <div>
          <label htmlFor="scheduledAt" className="block text-sm font-medium mb-1">
            {t('events.create.scheduledAt')}
          </label>
          <input
            id="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={!canEdit || isSaving || isDeleting}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Status Field */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1">
            {t('events.create.status')}
          </label>
          <div className="flex items-center gap-3">
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              disabled={!canEdit || isSaving || isDeleting}
              className="flex-1 px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="draft">{t('events.status.draft')}</option>
              <option value="ready">{t('events.status.ready')}</option>
              <option value="live">{t('events.status.live')}</option>
              <option value="completed">{t('events.status.completed')}</option>
            </select>
            <span className={`px-3 py-2 text-sm rounded ${statusColors[status]}`}>
              {t(`events.status.${status}`)}
            </span>
          </div>
        </div>

        {/* Service Order */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('events.serviceOrder.title')}</label>
          <ServiceOrderEditor
            items={items}
            onChange={setItems}
            songs={songs}
            readOnly={!canEdit || isSaving || isDeleting}
          />
        </div>
      </div>
    </div>
  );
}
