// packages/shared/src/hooks/useDisplays.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { Display, DisplaySettings } from '../types/display';

interface DisplayRow {
  id: string;
  church_id: string;
  name: string;
  location: string | null;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
  device_info: Display['deviceInfo'];
  default_background_id: string | null;
  settings: DisplaySettings;
  created_at: string;
  updated_at: string;
}

function mapRowToDisplay(row: DisplayRow): Display {
  return {
    id: row.id,
    churchId: row.church_id,
    name: row.name,
    location: row.location,
    pairingCode: row.pairing_code,
    pairingCodeExpiresAt: row.pairing_code_expires_at,
    pairedAt: row.paired_at,
    lastSeenAt: row.last_seen_at,
    deviceInfo: row.device_info,
    defaultBackgroundId: row.default_background_id,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isDisplayOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt).getTime();
  const now = Date.now();
  return now - lastSeen < 60000; // 60 seconds
}

export function useDisplays() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const displaysQuery = useQuery({
    queryKey: ['displays', user?.churchId],
    queryFn: async () => {
      if (!user?.churchId) return [];
      const { data, error } = await supabase
        .from('displays')
        .select('*')
        .eq('church_id', user.churchId)
        .not('paired_at', 'is', null)
        .order('name');
      if (error) throw error;
      return (data as unknown as DisplayRow[]).map(mapRowToDisplay);
    },
    enabled: !!user?.churchId,
  });

  // Subscribe to realtime updates for last_seen_at
  useEffect(() => {
    if (!user?.churchId) return;

    const channel = supabase
      .channel('displays-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'displays',
          filter: `church_id=eq.${user.churchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['displays', user.churchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.churchId, queryClient]);

  const removeDisplay = useMutation({
    mutationFn: async (displayId: string) => {
      if (!user?.churchId) throw new Error('Not authenticated');
      // Delete the display entirely - host app will create new one on next boot
      const { error } = await supabase
        .from('displays')
        .delete()
        .eq('id', displayId)
        .eq('church_id', user.churchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  return {
    displays: displaysQuery.data ?? [],
    isLoading: displaysQuery.isLoading,
    error: displaysQuery.error,
    refetch: displaysQuery.refetch,
    removeDisplay,
  };
}
