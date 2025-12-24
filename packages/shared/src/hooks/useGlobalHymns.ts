import { useQuery } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';

export interface GlobalHymn {
  id: string;
  title: string;
  author: string | null;
  composer: string | null;
  lyrics: string | null;
  source_url: string | null;
  is_public_domain: boolean;
  tags: string[] | null;
}

export function useGlobalHymns(searchQuery?: string) {
  const supabase = useSupabase();

  const hymnsQuery = useQuery({
    queryKey: ['global-hymns', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('songs')
        .select('id, title, author, composer, lyrics, source_url, is_public_domain, tags')
        .is('church_id', null)
        .order('title');

      // Apply search filter if provided
      if (searchQuery && searchQuery.trim()) {
        const search = searchQuery.trim().toLowerCase();
        query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
      }

      // Limit results to prevent overwhelming the UI
      query = query.limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return data as GlobalHymn[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    hymns: hymnsQuery.data ?? [],
    isLoading: hymnsQuery.isLoading,
    error: hymnsQuery.error,
  };
}
