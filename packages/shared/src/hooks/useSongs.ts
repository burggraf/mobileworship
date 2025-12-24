import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';

export function useSongs() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const songsQuery = useQuery({
    queryKey: ['songs', user?.churchId],
    queryFn: async () => {
      if (!user?.churchId) return [];
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('church_id', user.churchId)
        .order('title');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.churchId,
  });

  const createSong = useMutation({
    mutationFn: async (song: {
      title: string;
      author?: string;
      lyrics: string;
      ccliSongId?: string;
      key?: string;
      tempo?: number;
      tags?: string[];
    }) => {
      if (!user?.churchId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('songs')
        .insert({
          church_id: user.churchId,
          title: song.title,
          author: song.author,
          lyrics: song.lyrics,
          ccli_song_id: song.ccliSongId,
          key: song.key,
          tempo: song.tempo,
          tags: song.tags,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', user?.churchId] });
    },
  });

  const updateSong = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      author?: string;
      lyrics?: string;
      key?: string;
      tempo?: number;
      defaultBackgroundId?: string;
      transitionType?: string;
      tags?: string[];
      defaultArrangement?: string[];
    }) => {
      const { data, error } = await supabase
        .from('songs')
        .update({
          title: updates.title,
          author: updates.author,
          lyrics: updates.lyrics,
          key: updates.key,
          tempo: updates.tempo,
          default_background_id: updates.defaultBackgroundId,
          transition_type: updates.transitionType,
          tags: updates.tags,
          default_arrangement: updates.defaultArrangement,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', user?.churchId] });
    },
  });

  const deleteSong = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('songs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', user?.churchId] });
    },
  });

  return {
    songs: songsQuery.data ?? [],
    isLoading: songsQuery.isLoading,
    error: songsQuery.error,
    createSong,
    updateSong,
    deleteSong,
  };
}
