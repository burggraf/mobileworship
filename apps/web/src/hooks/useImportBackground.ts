import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase, useAuth } from '@mobileworship/shared';
import type { BackgroundSearchResult } from '../types/backgrounds';

export function useImportBackground() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (background: BackgroundSearchResult) => {
      const { data, error } = await supabase.functions.invoke('import-background', {
        body: {
          sourceUrl: background.fullUrl,
          source: background.source,
          photographer: background.photographer,
          photographerUrl: background.photographerUrl,
          sourcePageUrl: background.sourcePageUrl,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate media query to refresh the My Media tab
      queryClient.invalidateQueries({ queryKey: ['media', user?.churchId] });
    },
  });
}
