import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';

export function useMedia() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mediaQuery = useQuery({
    queryKey: ['media', user?.churchId],
    queryFn: async () => {
      if (!user?.churchId) return [];
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('church_id', user.churchId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.churchId,
  });

  const uploadMedia = useMutation({
    mutationFn: async ({
      file,
      type,
      tags,
    }: {
      file: File;
      type: 'image' | 'video';
      tags?: string[];
    }) => {
      if (!user?.churchId) throw new Error('Not authenticated');

      // Upload to storage
      const fileName = `${user.churchId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from('media')
        .insert({
          church_id: user.churchId,
          type,
          storage_path: fileName,
          source: 'upload',
          tags,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', user?.churchId] });
    },
  });

  const deleteMedia = useMutation({
    mutationFn: async (id: string) => {
      // Get the media record first to get storage path
      const { data: media, error: fetchError } = await supabase
        .from('media')
        .select('storage_path')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      // Delete from storage
      if (media?.storage_path) {
        await supabase.storage.from('media').remove([media.storage_path]);
      }

      // Delete database record
      const { error } = await supabase.from('media').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', user?.churchId] });
    },
  });

  const getPublicUrl = (storagePath: string) => {
    return supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl;
  };

  return {
    media: mediaQuery.data ?? [],
    isLoading: mediaQuery.isLoading,
    error: mediaQuery.error,
    uploadMedia,
    deleteMedia,
    getPublicUrl,
  };
}
