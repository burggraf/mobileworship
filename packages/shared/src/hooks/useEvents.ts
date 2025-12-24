import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { EventItem } from '../types';

export function useEvents() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ['events', user?.churchId],
    queryFn: async () => {
      if (!user?.churchId) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('church_id', user.churchId)
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.churchId,
  });

  const createEvent = useMutation({
    mutationFn: async (event: { title: string; scheduledAt?: string; items?: EventItem[] }) => {
      if (!user?.churchId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('events')
        .insert({
          church_id: user.churchId,
          title: event.title,
          scheduled_at: event.scheduledAt,
          items: event.items ?? [],
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.churchId] });
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      scheduledAt?: string;
      items?: EventItem[];
      status?: 'draft' | 'ready' | 'live' | 'completed';
    }) => {
      const { data, error } = await supabase
        .from('events')
        .update({
          title: updates.title,
          scheduled_at: updates.scheduledAt,
          items: updates.items,
          status: updates.status,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.churchId] });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', user?.churchId] });
    },
  });

  return {
    events: eventsQuery.data ?? [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
