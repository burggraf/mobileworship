import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSupabase, useMemberships } from '@mobileworship/shared';

export function DeleteChurchSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { churchMembers } = useMemberships();

  const [churchName, setChurchName] = useState<string>('');
  const [confirmName, setConfirmName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch church name on mount
  useEffect(() => {
    if (user?.churchId) {
      supabase
        .from('churches')
        .select('name')
        .eq('id', user.churchId)
        .single()
        .then(({ data }) => {
          if (data) setChurchName(data.name);
        });
    }
  }, [user?.churchId, supabase]);

  const isSoleMember = churchMembers.length === 1;
  const isAdmin = user?.role === 'admin';

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAdmin) {
      setError(t('settings.deleteChurch.mustBeAdmin'));
      return;
    }

    if (!isSoleMember) {
      setError(t('settings.deleteChurch.notLastMember'));
      return;
    }

    if (confirmName !== churchName) {
      return;
    }

    setIsDeleting(true);

    try {
      const { error: rpcError } = await supabase.rpc('delete_church', {
        p_church_id: user.churchId,
        p_confirmation: confirmName,
      });

      if (rpcError) throw rpcError;

      // Sign out and redirect to home
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      console.error('Failed to delete church:', err);
      setError(t('settings.deleteChurch.deleteFailed'));
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
          {t('settings.deleteChurch.title')}
        </h3>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {t('settings.deleteChurch.mustBeAdmin')}
        </p>
      </div>
    );
  }

  if (!isSoleMember) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
          {t('settings.deleteChurch.title')}
        </h3>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {t('settings.deleteChurch.description')}
        </p>
        <div className="mt-4 rounded-md border border-red-300 bg-red-100 p-4 dark:border-red-700 dark:bg-red-900/40">
          <p className="text-sm text-red-800 dark:text-red-200">
            {t('settings.deleteChurch.notLastMember')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
        {t('settings.deleteChurch.title')}
      </h3>
      <p className="mt-2 text-sm text-red-700 dark:text-red-300">
        {t('settings.deleteChurch.description')}
      </p>

      <div className="mt-4 rounded-md border border-red-300 bg-red-100 p-4 dark:border-red-700 dark:bg-red-900/40">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          {t('settings.deleteChurch.warning')}
        </p>
      </div>

      <form onSubmit={handleDelete} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="confirmName"
            className="block text-sm font-medium text-red-700 dark:text-red-300"
          >
            {t('settings.deleteChurch.confirmLabel', { churchName })}
          </label>
          <input
            type="text"
            id="confirmName"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={t('settings.deleteChurch.confirmPlaceholder')}
            className="mt-2 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-100 p-3 dark:bg-red-900/60">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isDeleting || confirmName !== churchName}
          className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-900"
        >
          {isDeleting
            ? t('settings.deleteChurch.deleting')
            : t('settings.deleteChurch.delete')}
        </button>
      </form>
    </div>
  );
}
