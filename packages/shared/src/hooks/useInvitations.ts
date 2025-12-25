import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { Invitation, Role } from '../types';

export function useInvitations() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch invitations for current church
  const invitationsQuery = useQuery({
    queryKey: ['invitations', user?.churchId],
    queryFn: async () => {
      // First fetch invitations without JOIN
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          id,
          church_id,
          email,
          role,
          invited_by,
          token,
          expires_at,
          accepted_at,
          created_at
        `)
        .eq('church_id', user!.churchId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch invited_by user names separately to avoid JOIN RLS issues
      const invitedByIds = [...new Set(data.map((inv) => inv.invited_by).filter(Boolean))];
      let usersMap: Record<string, string> = {};

      if (invitedByIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name')
          .in('id', invitedByIds);

        if (usersData) {
          usersMap = Object.fromEntries(usersData.map((u) => [u.id, u.name]));
        }
      }

      return data.map((inv) => ({
        id: inv.id,
        churchId: inv.church_id,
        email: inv.email,
        role: inv.role as Role,
        invitedBy: inv.invited_by,
        token: inv.token,
        expiresAt: inv.expires_at,
        acceptedAt: inv.accepted_at,
        createdAt: inv.created_at,
        invitedByUser: inv.invited_by && usersMap[inv.invited_by]
          ? { name: usersMap[inv.invited_by] }
          : undefined,
      })) as Invitation[];
    },
    enabled: !!user?.churchId,
  });

  // Create invitation
  const createInvitationMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Role }) => {
      // Check if user exists and is already a member
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        const { data: existingMember } = await supabase
          .from('church_memberships')
          .select('id')
          .eq('church_id', user!.churchId)
          .eq('user_id', existingUser.id)
          .maybeSingle();

        if (existingMember) {
          throw new Error('User is already a member of this church');
        }
      }

      // Check for pending invitation
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('church_id', user!.churchId)
        .eq('email', email)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingInvite) {
        throw new Error('An invitation is already pending for this email');
      }

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          church_id: user!.churchId,
          email,
          role,
          invited_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Send invitation email via Edge Function
      try {
        const { error: fnError } = await supabase.functions.invoke('send-invitation', {
          body: {
            invitationId: data.id,
            language: localStorage.getItem('i18nextLng') || 'en',
          },
        });
        if (fnError) {
          console.warn('Failed to send invitation email:', fnError);
        }
      } catch (emailError) {
        // Log but don't fail - invitation was created successfully
        console.warn('Error sending invitation email:', emailError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Resend invitation (updates expires_at and sends email again)
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);

      const { error } = await supabase
        .from('invitations')
        .update({ expires_at: newExpiry.toISOString() })
        .eq('id', invitationId);

      if (error) throw error;

      // Send invitation email via Edge Function
      try {
        const { error: fnError } = await supabase.functions.invoke('send-invitation', {
          body: {
            invitationId,
            language: localStorage.getItem('i18nextLng') || 'en',
          },
        });
        if (fnError) {
          console.warn('Failed to send invitation email:', fnError);
        }
      } catch (emailError) {
        console.warn('Error sending invitation email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Cancel invitation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Accept invitation (called after login with invite token)
  const acceptInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
      if (error) throw error;
      return data as { church_id: string; role: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Get invitation by token (for display before accepting)
  const getInvitationByToken = async (token: string): Promise<Invitation | null> => {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        id,
        church_id,
        email,
        role,
        invited_by,
        token,
        expires_at,
        accepted_at,
        created_at,
        churches:church_id (name)
      `)
      .eq('token', token)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      churchId: data.church_id,
      email: data.email,
      role: data.role as Role,
      invitedBy: data.invited_by,
      token: data.token,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
      createdAt: data.created_at ?? new Date().toISOString(),
      church: data.churches ? { id: data.church_id, name: data.churches.name } : undefined,
    };
  };

  return {
    invitations: invitationsQuery.data ?? [],
    isLoading: invitationsQuery.isLoading,
    createInvitation: createInvitationMutation.mutateAsync,
    isCreating: createInvitationMutation.isPending,
    resendInvitation: resendInvitationMutation.mutateAsync,
    isResending: resendInvitationMutation.isPending,
    cancelInvitation: cancelInvitationMutation.mutateAsync,
    isCanceling: cancelInvitationMutation.isPending,
    acceptInvitation: acceptInvitationMutation.mutateAsync,
    isAccepting: acceptInvitationMutation.isPending,
    getInvitationByToken,
  };
}
