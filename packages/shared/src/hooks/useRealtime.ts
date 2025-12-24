import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSupabase } from './useSupabase';
import type { EventItem, SongContent } from '../types';

export interface PresentationState {
  eventId: string;
  currentItemIndex: number;
  currentSectionIndex: number;
  isBlank: boolean;
}

interface UseRealtimeOptions {
  eventId: string;
  items: EventItem[];
  songs: Map<string, SongContent>;
}

export function useRealtime({ eventId, items, songs }: UseRealtimeOptions) {
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [state, setState] = useState<PresentationState>({
    eventId,
    currentItemIndex: 0,
    currentSectionIndex: 0,
    isBlank: false,
  });

  // Broadcast state changes
  const broadcast = useCallback(
    (newState: PresentationState) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'presentation_state',
          payload: newState,
        });
      }
    },
    []
  );

  // Get current item and its sections
  const getCurrentItem = useCallback(() => {
    if (!items || items.length === 0) return null;
    return items[state.currentItemIndex] || null;
  }, [items, state.currentItemIndex]);

  const getCurrentSections = useCallback(() => {
    const item = getCurrentItem();
    if (!item || item.type !== 'song') return [];

    const songContent = songs.get(item.id);
    if (!songContent) return [];

    // If arrangement is specified, use it to order sections
    if (item.arrangement && item.arrangement.length > 0) {
      return item.arrangement
        .map((idx) => songContent.sections[idx])
        .filter(Boolean);
    }

    return songContent.sections;
  }, [getCurrentItem, songs]);

  // Navigation functions
  const goNext = useCallback(() => {
    setState((prev) => {
      const sections = getCurrentSections();
      let newItemIndex = prev.currentItemIndex;
      let newSectionIndex = prev.currentSectionIndex;

      // Try to go to next section in current item
      if (sections.length > 0 && newSectionIndex < sections.length - 1) {
        newSectionIndex++;
      } else {
        // Move to next item
        if (newItemIndex < items.length - 1) {
          newItemIndex++;
          newSectionIndex = 0;
        }
        // Else stay at the last item/section
      }

      const newState = {
        ...prev,
        currentItemIndex: newItemIndex,
        currentSectionIndex: newSectionIndex,
      };
      broadcast(newState);
      return newState;
    });
  }, [items.length, getCurrentSections, broadcast]);

  const goPrev = useCallback(() => {
    setState((prev) => {
      let newItemIndex = prev.currentItemIndex;
      let newSectionIndex = prev.currentSectionIndex;

      // Try to go to previous section in current item
      if (newSectionIndex > 0) {
        newSectionIndex--;
      } else {
        // Move to previous item
        if (newItemIndex > 0) {
          newItemIndex--;
          // Get sections of previous item
          const prevItem = items[newItemIndex];
          if (prevItem && prevItem.type === 'song') {
            const songContent = songs.get(prevItem.id);
            if (songContent) {
              const sections = prevItem.arrangement && prevItem.arrangement.length > 0
                ? prevItem.arrangement.map((idx) => songContent.sections[idx]).filter(Boolean)
                : songContent.sections;
              newSectionIndex = Math.max(0, sections.length - 1);
            }
          } else {
            newSectionIndex = 0;
          }
        }
        // Else stay at the first item/section
      }

      const newState = {
        ...prev,
        currentItemIndex: newItemIndex,
        currentSectionIndex: newSectionIndex,
      };
      broadcast(newState);
      return newState;
    });
  }, [items, songs, broadcast]);

  const goToItem = useCallback(
    (itemIndex: number) => {
      setState((prev) => {
        const newState = {
          ...prev,
          currentItemIndex: itemIndex,
          currentSectionIndex: 0,
        };
        broadcast(newState);
        return newState;
      });
    },
    [broadcast]
  );

  const goToSection = useCallback(
    (sectionIndex: number) => {
      setState((prev) => {
        const newState = {
          ...prev,
          currentSectionIndex: sectionIndex,
        };
        broadcast(newState);
        return newState;
      });
    },
    [broadcast]
  );

  const toggleBlank = useCallback(() => {
    setState((prev) => {
      const newState = {
        ...prev,
        isBlank: !prev.isBlank,
      };
      broadcast(newState);
      return newState;
    });
  }, [broadcast]);

  // Set up realtime channel
  useEffect(() => {
    const channel = supabase.channel(`event:${eventId}`);

    // Subscribe to broadcast events from other clients
    channel
      .on('broadcast', { event: 'presentation_state' }, ({ payload }) => {
        setState(payload as PresentationState);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabase, eventId]);

  return {
    state,
    goNext,
    goPrev,
    goToItem,
    goToSection,
    toggleBlank,
    getCurrentItem,
    getCurrentSections,
  };
}
