import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { ChurchMembership, Role } from '../types';

export function useMemberships() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all memberships for current user (for church switcher)
  const myMembershipsQuery = useQuery({
    queryKey: ['memberships', 'mine'],
    queryFn: async () => {
      // Fetch memberships without JOIN to avoid RLS issues
      const { data, error } = await supabase
        .from('church_memberships')
        .select(`
          id,
          user_id,
          church_id,
          role,
          last_accessed_at,
          created_at
        `)
        .eq('user_id', user!.id)
        .order('last_accessed_at', { ascending: false });

      if (error) throw error;

      // Fetch church names separately
      const churchIds = [...new Set(data.map((m) => m.church_id))];
      let churchesMap: Record<string, { id: string; name: string }> = {};

      if (churchIds.length > 0) {
        const { data: churchesData } = await supabase
          .from('churches')
          .select('id, name')
          .in('id', churchIds);

        if (churchesData) {
          churchesMap = Object.fromEntries(churchesData.map((c) => [c.id, { id: c.id, name: c.name }]));
        }
      }

      return data.map((m) => ({
        id: m.id,
        userId: m.user_id,
        churchId: m.church_id,
        role: m.role as Role,
        lastAccessedAt: m.last_accessed_at,
        createdAt: m.created_at,
        church: churchesMap[m.church_id] || undefined,
      })) as ChurchMembership[];
    },
    enabled: !!user?.id,
  });

  // Fetch all members of current church (for team management)
  const churchMembersQuery = useQuery({
    queryKey: ['memberships', 'church', user?.churchId],
    queryFn: async () => {
      // Fetch memberships without JOIN to avoid RLS issues
      const { data, error } = await supabase
        .from('church_memberships')
        .select(`
          id,
          user_id,
          church_id,
          role,
          last_accessed_at,
          created_at
        `)
        .eq('church_id', user!.churchId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user details separately
      const userIds = [...new Set(data.map((m) => m.user_id))];
      let usersMap: Record<string, { id: string; name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds);

        if (usersData) {
          usersMap = Object.fromEntries(usersData.map((u) => [u.id, { id: u.id, name: u.name, email: u.email }]));
        }
      }

      return data.map((m) => ({
        id: m.id,
        userId: m.user_id,
        churchId: m.church_id,
        role: m.role as Role,
        lastAccessedAt: m.last_accessed_at,
        createdAt: m.created_at,
        user: usersMap[m.user_id] || undefined,
      })) as ChurchMembership[];
    },
    enabled: !!user?.churchId,
  });

  // Change member role
  const changeRoleMutation = useMutation({
    mutationFn: async ({ membershipId, newRole }: { membershipId: string; newRole: Role }) => {
      const { error } = await supabase
        .from('church_memberships')
        .update({ role: newRole })
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase
        .from('church_memberships')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  // Get admin count for validation
  const getAdminCount = async (churchId: string): Promise<number> => {
    const { data, error } = await supabase.rpc('get_admin_count', { p_church_id: churchId });
    if (error) throw error;
    return data;
  };

  return {
    myMemberships: myMembershipsQuery.data ?? [],
    isLoadingMyMemberships: myMembershipsQuery.isLoading,
    churchMembers: churchMembersQuery.data ?? [],
    isLoadingChurchMembers: churchMembersQuery.isLoading,
    changeRole: changeRoleMutation.mutateAsync,
    isChangingRole: changeRoleMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemovingMember: removeMemberMutation.isPending,
    getAdminCount,
  };
}
