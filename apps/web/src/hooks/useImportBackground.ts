import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase, useAuth } from '@mobileworship/shared';
import type { BackgroundSearchResult } from '../types/backgrounds';

export function useImportBackground() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (background: BackgroundSearchResult) => {
      // Get session and explicitly pass auth header
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session ? `exists, expires: ${session.expires_at}` : 'null');
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('import-background', {
        body: {
          sourceUrl: background.fullUrl,
          source: background.source,
          photographer: background.photographer,
          photographerUrl: background.photographerUrl,
          sourcePageUrl: background.sourcePageUrl,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Import error:', error, 'Response:', data);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      // Invalidate media query to refresh the My Media tab
      queryClient.invalidateQueries({ queryKey: ['media', user?.churchId] });
    },
  });
}
