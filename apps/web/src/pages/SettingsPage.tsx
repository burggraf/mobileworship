import { useAuth } from '@mobileworship/shared';

export function SettingsPage() {
  const { user, can } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-semibold mb-4">Profile</h3>
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">Name</label>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">Email</label>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400">Role</label>
              <p className="font-medium capitalize">{user?.role}</p>
            </div>
          </div>
        </section>

        {can('church:manage') && (
          <section>
            <h3 className="text-lg font-semibold mb-4">Church Settings</h3>
            <div className="p-4 border dark:border-gray-700 rounded-lg">
              <p className="text-gray-500">Church settings coming soon...</p>
            </div>
          </section>
        )}

        {can('church:manage') && (
          <section>
            <h3 className="text-lg font-semibold mb-4">Billing</h3>
            <div className="p-4 border dark:border-gray-700 rounded-lg">
              <p className="text-gray-500">Stripe billing integration coming soon...</p>
            </div>
          </section>
        )}

        {can('integrations:manage') && (
          <section>
            <h3 className="text-lg font-semibold mb-4">Integrations</h3>
            <div className="p-4 border dark:border-gray-700 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">CCLI</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Song licensing and reporting
                  </p>
                </div>
                <button className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Connect
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Planning Center</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sync songs and services</p>
                </div>
                <button className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Connect
                </button>
              </div>
            </div>
          </section>
        )}

        {can('church:users') && (
          <section>
            <h3 className="text-lg font-semibold mb-4">Team Members</h3>
            <div className="p-4 border dark:border-gray-700 rounded-lg">
              <p className="text-gray-500">User management coming soon...</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
