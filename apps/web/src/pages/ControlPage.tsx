import { useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useEvents, useSongs, useRealtime, parseSongMarkdown } from '@mobileworship/shared';
import type { EventItem, ParsedSong } from '@mobileworship/shared';

export function ControlPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const { user, isLoading, can } = useAuth();
  const { events } = useEvents();
  const { songs } = useSongs();

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

  // Initialize realtime control
  const {
    state,
    goNext,
    goPrev,
    goToItem,
    goToSection,
    toggleBlank,
    getCurrentItem,
    getCurrentSections,
  } = useRealtime({
    eventId: eventId || '',
    items,
    songs: songsMap,
  });

  // Get current and next sections
  const currentItem = getCurrentItem();
  const currentSections = getCurrentSections();
  const currentSection = currentSections[state.currentSectionIndex];
  const nextSection = currentSections[state.currentSectionIndex + 1];

  // Get item title
  const getItemTitle = (item: EventItem): string => {
    if (item.type === 'song') {
      const song = songs.find((s) => s.id === item.id);
      return song?.title || t('control.unknownSong');
    }
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!can('control:operate')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{t('control.eventNotFound')}</p>
          <Link to="/dashboard" className="text-primary-600 hover:underline">
            {t('control.backToDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="border-b dark:border-gray-800 bg-white dark:bg-gray-950 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← {t('control.back')}
          </Link>
          <h1 className="font-bold text-lg">{event.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('control.connected')}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Service Order Sidebar */}
        <aside className="w-64 border-r dark:border-gray-800 bg-white dark:bg-gray-950 overflow-y-auto">
          <div className="p-4">
            <h2 className="font-semibold mb-4">{t('control.serviceOrder')}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500">{t('control.noItems')}</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => goToItem(index)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      state.currentItemIndex === index
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="text-sm">
                      {index + 1}. {getItemTitle(item)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Control Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 gap-6">
              {/* Current Slide */}
              <div className="border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 p-4">
                <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                  {t('control.current')}
                </h3>
                <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white p-6 relative">
                  {state.isBlank ? (
                    <div className="text-center">
                      <div className="text-4xl mb-2">⬛</div>
                      <p className="text-gray-400 text-sm">{t('control.screenBlank')}</p>
                    </div>
                  ) : currentSection ? (
                    <div className="text-center w-full">
                      <div className="text-sm text-gray-400 mb-3">{currentSection.label}</div>
                      <div className="space-y-2">
                        {currentSection.lines.map((line, i) => (
                          <p key={i} className="text-xl leading-relaxed">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400">{t('control.noSlide')}</p>
                  )}
                </div>
              </div>

              {/* Next Slide */}
              <div className="border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 p-4">
                <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">{t('control.next')}</h3>
                <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white p-6">
                  {nextSection ? (
                    <div className="text-center w-full opacity-70">
                      <div className="text-sm text-gray-500 mb-3">{nextSection.label}</div>
                      <div className="space-y-2">
                        {nextSection.lines.map((line, i) => (
                          <p key={i} className="text-lg leading-relaxed">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">-</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Song Sections Sidebar */}
        <aside className="w-64 border-l dark:border-gray-800 bg-white dark:bg-gray-950 overflow-y-auto">
          <div className="p-4">
            <h2 className="font-semibold mb-4">{t('control.sections')}</h2>
            {currentItem && currentItem.type === 'song' && currentSections.length > 0 ? (
              <div className="space-y-1">
                {currentSections.map((section, index) => (
                  <button
                    key={index}
                    onClick={() => goToSection(index)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      state.currentSectionIndex === index
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="text-sm">{section.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {section.lines[0] || ''}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {currentItem ? t('control.noSections') : t('control.selectItem')}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Control Bar */}
      <footer className="border-t dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4">
          <button
            onClick={goPrev}
            disabled={state.currentItemIndex === 0 && state.currentSectionIndex === 0}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {t('control.previous')}
          </button>
          <button
            onClick={toggleBlank}
            className={`px-6 py-3 rounded-lg transition font-medium ${
              state.isBlank
                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                : 'bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
          >
            {state.isBlank ? t('control.unblank') : t('control.blank')}
          </button>
          <button
            onClick={goNext}
            disabled={
              state.currentItemIndex === items.length - 1 &&
              state.currentSectionIndex === currentSections.length - 1
            }
            className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('control.next')}
          </button>
        </div>
      </footer>
    </div>
  );
}
