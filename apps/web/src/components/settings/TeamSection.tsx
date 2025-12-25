import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useMemberships, useInvitations } from '@mobileworship/shared';
import { getInvitationStatus, type Role } from '@mobileworship/shared';

export function TeamSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    churchMembers,
    isLoadingChurchMembers,
    changeRole,
    isChangingRole,
    removeMember,
    isRemovingMember,
    getAdminCount,
  } = useMemberships();
  const {
    invitations,
    isLoading: isLoadingInvitations,
    createInvitation,
    isCreating,
    resendInvitation,
    isResending,
    cancelInvitation,
    isCanceling,
  } = useInvitations();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('operator');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter pending invitations
  const pendingInvitations = invitations.filter(
    (inv) => getInvitationStatus(inv) === 'pending'
  );

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      setError(t('settings.team.emailPlaceholder'));
      return;
    }

    setError('');
    setSuccess('');

    try {
      await createInvitation({ email: inviteEmail.trim(), role: inviteRole });
      setSuccess(t('settings.team.inviteSent'));
      setInviteEmail('');
      setInviteRole('operator');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('already a member')) {
        setError(t('settings.team.alreadyMember'));
      } else if (message.includes('already pending')) {
        setError(t('settings.team.alreadyInvited'));
      } else {
        setError(t('settings.team.inviteFailed'));
      }
    }
  };

  const handleChangeRole = async (membershipId: string, currentRole: Role, newRole: Role) => {
    if (currentRole === newRole) return;

    setError('');
    setSuccess('');

    // Check if demoting last admin
    if (currentRole === 'admin' && user?.churchId) {
      const adminCount = await getAdminCount(user.churchId);
      if (adminCount <= 1) {
        setError(t('settings.team.cannotDemoteLastAdmin'));
        return;
      }
    }

    try {
      await changeRole({ membershipId, newRole });
      setSuccess(t('settings.team.roleChanged'));
    } catch (err) {
      setError(t('settings.team.roleChangeFailed'));
    }
  };

  const handleRemoveMember = async (membershipId: string, role: Role, name: string) => {
    if (!window.confirm(t('settings.team.removeConfirm', { name }))) {
      return;
    }

    setError('');
    setSuccess('');

    // Check if removing last admin
    if (role === 'admin' && user?.churchId) {
      const adminCount = await getAdminCount(user.churchId);
      if (adminCount <= 1) {
        setError(t('settings.team.cannotRemoveLastAdmin'));
        return;
      }
    }

    try {
      await removeMember(membershipId);
      setSuccess(t('settings.team.memberRemoved'));
    } catch (err) {
      setError(t('settings.team.removeFailed'));
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    setError('');
    setSuccess('');

    try {
      await resendInvitation(invitationId);
      setSuccess(t('settings.team.inviteResent'));
    } catch (err) {
      setError(t('settings.team.inviteFailed'));
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setError('');
    setSuccess('');

    try {
      await cancelInvitation(invitationId);
      setSuccess(t('settings.team.inviteCanceled'));
    } catch (err) {
      setError(t('settings.team.inviteFailed'));
    }
  };

  const getExpiryLabel = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();

    if (expiryDate < now) {
      return t('settings.team.expired');
    }

    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    return t('settings.team.expires', {
      date: formatter.format(daysUntilExpiry, 'day')
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('settings.team.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('settings.team.description')}
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-md bg-red-100 dark:bg-red-900/30 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-100 dark:bg-green-900/30 p-4">
          <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* Invite Form */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          {t('settings.team.invite')}
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.team.inviteDescription')}
        </p>

        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={t('settings.team.emailPlaceholder')}
            className="flex-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
            className="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="operator">{t('settings.team.roles.operator')}</option>
            <option value="editor">{t('settings.team.roles.editor')}</option>
            <option value="admin">{t('settings.team.roles.admin')}</option>
          </select>
          <button
            onClick={handleSendInvite}
            disabled={isCreating}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? t('settings.team.sending') : t('settings.team.sendInvite')}
          </button>
        </div>
      </div>

      {/* Members List */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          {t('settings.team.members')}
        </h4>
        {isLoadingChurchMembers ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('common.loading')}
          </div>
        ) : churchMembers.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('settings.team.noMembers')}
          </div>
        ) : (
          <div className="space-y-2">
            {churchMembers.map((member) => {
              const isCurrentUser = member.userId === user?.id;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.user?.name}
                      </p>
                      {isCurrentUser && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t('settings.team.you')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {member.user?.email}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleChangeRole(member.id, member.role, e.target.value as Role)
                      }
                      disabled={isCurrentUser || isChangingRole}
                      className="px-3 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="operator">{t('settings.team.roles.operator')}</option>
                      <option value="editor">{t('settings.team.roles.editor')}</option>
                      <option value="admin">{t('settings.team.roles.admin')}</option>
                    </select>

                    {!isCurrentUser && (
                      <button
                        onClick={() =>
                          handleRemoveMember(
                            member.id,
                            member.role,
                            member.user?.name || member.user?.email || 'User'
                          )
                        }
                        disabled={isRemovingMember}
                        className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('settings.team.removeMember')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          {t('settings.team.invitations')}
        </h4>
        {isLoadingInvitations ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('common.loading')}
          </div>
        ) : pendingInvitations.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('settings.team.noInvitations')}
          </div>
        ) : (
          <div className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {invitation.email}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {t(`settings.team.roles.${invitation.role}`)}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-500">•</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {getExpiryLabel(invitation.expiresAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/accept-invite?token=${invitation.token}`;
                      navigator.clipboard.writeText(link);
                      setSuccess(t('settings.team.linkCopied'));
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors"
                    data-invitation-token={invitation.token}
                  >
                    {t('settings.team.copyLink')}
                  </button>
                  <button
                    onClick={() => handleResendInvite(invitation.id)}
                    disabled={isResending}
                    className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending ? t('settings.team.resending') : t('settings.team.resendInvite')}
                  </button>
                  <button
                    onClick={() => handleCancelInvite(invitation.id)}
                    disabled={isCanceling}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCanceling ? t('settings.team.canceling') : t('settings.team.cancelInvite')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
