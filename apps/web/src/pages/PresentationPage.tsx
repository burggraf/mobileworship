import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSupabase, useEvents, useSongs, useMedia, parseSongMarkdown } from '@mobileworship/shared';
import type { PresentationState, EventItem, ParsedSong, SongSection } from '@mobileworship/shared';

export function PresentationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const supabase = useSupabase();
  const { events } = useEvents();
  const { songs } = useSongs();
  const { media, getPublicUrl } = useMedia();

  const [presentationState, setPresentationState] = useState<PresentationState>({
    eventId: eventId || '',
    currentItemIndex: 0,
    currentSectionIndex: 0,
    isBlank: false,
  });

  // Get current event
  const event = useMemo(() => {
    return events.find((e) => e.id === eventId);
  }, [events, eventId]);

  // Parse event items
  const items = useMemo(() => {
    if (!event?.items) return [];
    return (event.items as unknown as EventItem[]) || [];
  }, [event]);

  // Create a map of song ID to parsed song for quick lookup
  const songsMap = useMemo(() => {
    const map = new Map<string, ParsedSong>();
    songs.forEach((song) => {
      if (song.lyrics) {
        map.set(song.id, parseSongMarkdown(song.lyrics));
      }
    });
    return map;
  }, [songs]);

  // Get current item, sections, and section
  const currentItem = useMemo(() => {
    if (!items || items.length === 0) return null;
    return items[presentationState.currentItemIndex] || null;
  }, [items, presentationState.currentItemIndex]);

  const currentSections = useMemo((): SongSection[] => {
    if (!currentItem || currentItem.type !== 'song') return [];

    const parsedSong = songsMap.get(currentItem.id);
    if (!parsedSong) return [];

    // If arrangement is specified, use it to order sections by label
    if (currentItem.arrangement && currentItem.arrangement.length > 0) {
      return currentItem.arrangement
        .map((label) => parsedSong.sections.find((s) => s.label === label))
        .filter((s): s is SongSection => s !== undefined);
    }

    return parsedSong.sections;
  }, [currentItem, songsMap]);

  const currentSection = useMemo(() => {
    return currentSections[presentationState.currentSectionIndex] || null;
  }, [currentSections, presentationState.currentSectionIndex]);

  // Get background image URL if set
  const backgroundImageUrl = useMemo(() => {
    if (!currentItem || currentItem.type !== 'song') return null;

    const song = songs.find((s) => s.id === currentItem.id);
    if (!song) return null;

    // Check if item has a custom background override
    const backgroundId = currentItem.backgroundId || song.default_background_id;
    if (!backgroundId) return null;

    // Find the media item and get its storage path
    const mediaItem = media.find((m) => m.id === backgroundId);
    if (!mediaItem?.storage_path) return null;

    return getPublicUrl(mediaItem.storage_path);
  }, [currentItem, songs, media, getPublicUrl]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase.channel(`event:${eventId}`);

    channel
      .on('broadcast', { event: 'presentation_state' }, ({ payload }) => {
        setPresentationState(payload as PresentationState);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, eventId]);

  // Render blank screen
  if (presentationState.isBlank) {
    return <div className="min-h-screen bg-black" />;
  }

  // Render lyrics with optional background
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background image */}
      {backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${backgroundImageUrl})` }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-5xl w-full">
        {currentSection ? (
          <>
            {/* Section label */}
            <div className="text-2xl text-gray-400 mb-8 text-center">
              {currentSection.label}
            </div>

            {/* Lyrics lines */}
            <div className="text-5xl md:text-6xl lg:text-7xl font-semibold text-center leading-relaxed space-y-4">
              {currentSection.lines.map((line, index) => (
                <p key={index} className="transition-opacity duration-300">
                  {line}
                </p>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 text-2xl">
            No content to display
          </div>
        )}
      </div>
    </div>
  );
}
