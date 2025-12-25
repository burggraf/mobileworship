import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSupabase } from './useSupabase';
import type { EventItem, ParsedSong, SongSection } from '../types';

export interface PresentationState {
  eventId: string;
  currentItemIndex: number;
  currentSectionIndex: number;
  isBlank: boolean;
}

interface SlideContent {
  label: string;
  lines: string[];
  backgroundUrl?: string;
}

interface UseRealtimeOptions {
  eventId: string;
  items: EventItem[];
  songs: Map<string, ParsedSong>;
  displayIds?: string[];
  getBackgroundUrl?: (songId: string) => string | undefined;
}

export function useRealtime({ eventId, items, songs, displayIds = [], getBackgroundUrl }: UseRealtimeOptions) {
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const displayChannelsRef = useRef<RealtimeChannel[]>([]);

  const [state, setState] = useState<PresentationState>({
    eventId,
    currentItemIndex: 0,
    currentSectionIndex: 0,
    isBlank: false,
  });

  // Helper to get slide content for current state
  const getSlideContent = useCallback((itemIndex: number, sectionIndex: number): SlideContent | null => {
    const item = items[itemIndex];
    if (!item || item.type !== 'song') return null;

    const parsedSong = songs.get(item.id);
    if (!parsedSong) return null;

    // Get sections (with arrangement if specified)
    const sections: SongSection[] = item.arrangement && item.arrangement.length > 0
      ? item.arrangement
          .map((label) => parsedSong.sections.find((s) => s.label === label))
          .filter((s): s is SongSection => s !== undefined)
      : parsedSong.sections;

    const section = sections[sectionIndex];
    if (!section) return null;

    return {
      label: section.label,
      lines: section.lines,
      backgroundUrl: getBackgroundUrl?.(item.id),
    };
  }, [items, songs, getBackgroundUrl]);

  // Send command to all displays
  const sendToDisplays = useCallback((command: Record<string, unknown>) => {
    displayChannelsRef.current.forEach(channel => {
      channel.send({
        type: 'broadcast',
        event: 'command',
        payload: command,
      });
    });
  }, []);

  // Broadcast state changes to other controllers and send slide to displays
  const broadcast = useCallback(
    (newState: PresentationState) => {
      // Broadcast to other controllers
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'presentation_state',
          payload: newState,
        });
      }

      // Send slide content to displays
      if (newState.isBlank) {
        sendToDisplays({ type: 'BLANK_SCREEN' });
      } else {
        const slide = getSlideContent(newState.currentItemIndex, newState.currentSectionIndex);
        if (slide) {
          sendToDisplays({ type: 'SET_SLIDE', slide });
        }
      }
    },
    [sendToDisplays, getSlideContent]
  );

  // Get current item and its sections
  const getCurrentItem = useCallback(() => {
    if (!items || items.length === 0) return null;
    return items[state.currentItemIndex] || null;
  }, [items, state.currentItemIndex]);

  const getCurrentSections = useCallback(() => {
    const item = getCurrentItem();
    if (!item || item.type !== 'song') return [];

    const parsedSong = songs.get(item.id);
    if (!parsedSong) return [];

    // If arrangement is specified, use it to order sections by label
    if (item.arrangement && item.arrangement.length > 0) {
      return item.arrangement
        .map((label) => parsedSong.sections.find((s) => s.label === label))
        .filter((s): s is typeof parsedSong.sections[0] => s !== undefined);
    }

    return parsedSong.sections;
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
            const parsedSong = songs.get(prevItem.id);
            if (parsedSong) {
              const sections = prevItem.arrangement && prevItem.arrangement.length > 0
                ? prevItem.arrangement
                    .map((label) => parsedSong.sections.find((s) => s.label === label))
                    .filter(Boolean)
                : parsedSong.sections;
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

  // Set up realtime channel for controllers
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

  // Set up display channels - only recreate when displayIds change
  useEffect(() => {
    if (displayIds.length === 0) return;

    const channels = displayIds.map(displayId => {
      const channel = supabase.channel(`display:${displayId}`);
      return channel;
    });

    // Subscribe all channels and wait for them to be ready
    Promise.all(channels.map(channel =>
      new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          }
        });
      })
    )).then(() => {
      displayChannelsRef.current = channels;

      // Send initial slide after all channels are subscribed
      const slide = getSlideContent(state.currentItemIndex, state.currentSectionIndex);
      if (slide) {
        channels.forEach(channel => {
          channel.send({
            type: 'broadcast',
            event: 'command',
            payload: { type: 'SET_SLIDE', slide },
          });
        });
      }
    });

    return () => {
      channels.forEach(channel => channel.unsubscribe());
      displayChannelsRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, displayIds.join(',')]); // Only recreate when displayIds actually change

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
