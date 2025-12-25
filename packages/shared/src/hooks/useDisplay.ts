// packages/shared/src/hooks/useDisplay.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useDisplay(displayId: string | null) {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const displayQuery = useQuery({
    queryKey: ['display', displayId],
    queryFn: async () => {
      if (!displayId) return null;
      const { data, error } = await supabase
        .from('displays')
        .select('*')
        .eq('id', displayId)
        .single();
      if (error) throw error;
      return mapRowToDisplay(data as unknown as DisplayRow);
    },
    enabled: !!displayId,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<DisplaySettings>) => {
      if (!displayId || !displayQuery.data) throw new Error('No display');
      const newSettings = { ...displayQuery.data.settings, ...settings };
      const { error } = await supabase
        .from('displays')
        .update({ settings: JSON.parse(JSON.stringify(newSettings)) })
        .eq('id', displayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display', displayId] });
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  const updateName = useMutation({
    mutationFn: async ({ name, location }: { name: string; location?: string }) => {
      if (!displayId) throw new Error('No display');
      const { error } = await supabase
        .from('displays')
        .update({ name, location: location || null })
        .eq('id', displayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display', displayId] });
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!displayId) throw new Error('No display');
      // Delete the display entirely - host app will create new one on next boot
      const { error } = await supabase
        .from('displays')
        .delete()
        .eq('id', displayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  const testConnection = async (): Promise<boolean> => {
    if (!displayId) return false;
    try {
      const channel = supabase.channel(`display:${displayId}`);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          channel.unsubscribe();
          resolve(false);
        }, 5000);

        channel
          .on('broadcast', { event: 'pong' }, () => {
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve(true);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({ type: 'broadcast', event: 'ping', payload: {} });
            }
          });
      });
    } catch {
      return false;
    }
  };

  return {
    display: displayQuery.data ?? null,
    isLoading: displayQuery.isLoading,
    error: displayQuery.error,
    updateSettings,
    updateName,
    remove,
    testConnection,
  };
}
