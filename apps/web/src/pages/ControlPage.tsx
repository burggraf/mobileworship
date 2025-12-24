import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@mobileworship/shared';

export function ControlPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, isLoading, can } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!can('control:operate')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b dark:border-gray-800 p-4 flex items-center justify-between">
        <h1 className="font-bold">Live Control</h1>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Connected (Local)</span>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Service Order Sidebar */}
        <aside className="w-64 border-r dark:border-gray-800 p-4">
          <h2 className="font-semibold mb-4">Service Order</h2>
          <p className="text-sm text-gray-500">Event: {eventId}</p>
          {/* TODO: List event items */}
        </aside>

        {/* Main Control Area */}
        <main className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Current Slide */}
            <div className="border dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Current</h3>
              <div className="aspect-video bg-black rounded flex items-center justify-center text-white">
                {/* Current slide preview */}
                <p className="text-gray-400">No slide selected</p>
              </div>
            </div>

            {/* Next Slide */}
            <div className="border dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Next</h3>
              <div className="aspect-video bg-gray-900 rounded flex items-center justify-center text-white">
                {/* Next slide preview */}
                <p className="text-gray-500">-</p>
              </div>
            </div>
          </div>
        </main>

        {/* Song Sections Sidebar */}
        <aside className="w-64 border-l dark:border-gray-800 p-4">
          <h2 className="font-semibold mb-4">Sections</h2>
          {/* TODO: List song sections */}
        </aside>
      </div>

      {/* Control Bar */}
      <footer className="border-t dark:border-gray-800 p-4 flex items-center justify-center gap-4">
        <button className="px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">
          Previous
        </button>
        <button className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition">
          Blank
        </button>
        <button className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-lg font-medium">
          Next
        </button>
      </footer>
    </div>
  );
}
