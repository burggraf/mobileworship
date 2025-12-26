// packages/shared/src/hooks/useDisplays.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
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

// Helper to get presence channel name (must match host app)
const getPresenceChannel = (churchId: string) => `church:${churchId}:presence`;

// Presence payload tracked by host app
interface DisplayPresencePayload {
  displayId: string;
  name: string;
  online_at: string;
}

// Supabase presence includes presence_ref plus the tracked data
interface PresenceState extends DisplayPresencePayload {
  presence_ref: string;
}

// Legacy fallback for when presence isn't available
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
  const [onlineDisplayIds, setOnlineDisplayIds] = useState<Set<string>>(new Set());

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

  // Subscribe to presence channel for instant online/offline status
  useEffect(() => {
    if (!user?.churchId) return;

    const presenceChannel = supabase.channel(getPresenceChannel(user.churchId));

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = new Set<string>();

        // Presence state is keyed by a unique ID, values are arrays of presence objects
        Object.values(state).forEach((presences) => {
          (presences as unknown as PresenceState[]).forEach((presence) => {
            if (presence.displayId) {
              onlineIds.add(presence.displayId);
            }
          });
        });

        setOnlineDisplayIds(onlineIds);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineDisplayIds((prev) => {
          const next = new Set(prev);
          (newPresences as unknown as PresenceState[]).forEach((presence) => {
            if (presence.displayId) {
              next.add(presence.displayId);
            }
          });
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineDisplayIds((prev) => {
          const next = new Set(prev);
          (leftPresences as unknown as PresenceState[]).forEach((presence) => {
            if (presence.displayId) {
              next.delete(presence.displayId);
            }
          });
          return next;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [supabase, user?.churchId]);

  // Subscribe to database changes for display list updates (INSERT, UPDATE, DELETE)
  useEffect(() => {
    if (!user?.churchId) return;

    const channel = supabase
      .channel('displays-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'displays',
          filter: `church_id=eq.${user.churchId}`,
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['displays', user.churchId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'displays',
          // Also listen to all UPDATEs to catch newly claimed displays
          // (when church_id changes from null to a value)
        },
        (payload) => {
          const newRow = payload.new as { church_id?: string };
          if (newRow.church_id === user.churchId) {
            // Small delay to ensure write is visible for read
            setTimeout(() => {
              queryClient.refetchQueries({ queryKey: ['displays', user.churchId] });
            }, 100);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'displays',
          filter: `church_id=eq.${user.churchId}`,
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['displays', user.churchId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'displays',
          // Note: DELETE events cannot be filtered - must listen to all deletes
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['displays', user.churchId] });
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

  // Check if a display is online using presence (instant) with fallback to lastSeenAt
  const checkDisplayOnline = useCallback((displayId: string, lastSeenAt: string | null): boolean => {
    // Prefer presence-based status (instant)
    if (onlineDisplayIds.has(displayId)) {
      return true;
    }
    // Fall back to lastSeenAt for displays that haven't connected with presence yet
    return isDisplayOnline(lastSeenAt);
  }, [onlineDisplayIds]);

  return {
    displays: displaysQuery.data ?? [],
    isLoading: displaysQuery.isLoading,
    error: displaysQuery.error,
    refetch: displaysQuery.refetch,
    removeDisplay,
    onlineDisplayIds,
    checkDisplayOnline,
  };
}
