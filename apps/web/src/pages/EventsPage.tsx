import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvents, useAuth } from '@mobileworship/shared';
import { CreateEventModal } from '../components/CreateEventModal';

export function EventsPage() {
  const { events, isLoading } = useEvents();
  const { can } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return <div className="text-gray-500">Loading events...</div>;
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    live: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    completed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Events</h2>
        {can('events:write') && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Create Event
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No events yet. Create your first service to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="p-4 border dark:border-gray-700 rounded-lg flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold">{event.title}</h3>
                {event.scheduled_at && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(event.scheduled_at).toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2 py-1 text-xs rounded ${statusColors[event.status || 'draft']}`}>
                  {event.status || 'draft'}
                </span>
                {can('control:operate') && event.status !== 'completed' && (
                  <Link
                    to={`/control/${event.id}`}
                    className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition"
                  >
                    Control
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateEventModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
