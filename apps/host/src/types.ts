// Local types for host app - inlined to avoid pnpm React duplicate issues

// Display types
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type TextPosition = 'center' | 'bottom' | 'lower-third';
export type FontFamily = 'system' | 'serif' | 'sans-serif';

export interface DisplayMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DisplaySettings {
  fontSize: FontSize;
  textPosition: TextPosition;
  margins: DisplayMargins;
  fontFamily: FontFamily;
  textShadow: boolean;
  overlayOpacity: number;
}

export interface DeviceInfo {
  platform: 'android' | 'android-tv' | 'ios' | 'macos' | 'windows';
  version: string;
  resolution: {
    width: number;
    height: number;
  };
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontSize: 'medium',
  textPosition: 'center',
  margins: { top: 5, bottom: 10, left: 5, right: 5 },
  fontFamily: 'system',
  textShadow: true,
  overlayOpacity: 0.3,
};

// Protocol types
export type TransitionType = 'cut' | 'fade' | 'slide';

export interface SlideContent {
  label: string;
  lines: string[];
  backgroundUrl?: string;
}

// All commands include optional commandId for deduplication across local/remote channels
export type ClientCommand =
  | { type: 'LOAD_EVENT'; eventId: string; commandId?: string }
  | { type: 'UNLOAD_EVENT'; commandId?: string }
  | { type: 'SET_SLIDE'; slide: SlideContent; commandId?: string }
  | { type: 'GOTO_SLIDE'; slideIndex: number; commandId?: string }
  | { type: 'GOTO_SECTION'; sectionIndex: number; commandId?: string }
  | { type: 'GOTO_ITEM'; itemIndex: number; commandId?: string }
  | { type: 'NEXT_SLIDE'; commandId?: string }
  | { type: 'PREV_SLIDE'; commandId?: string }
  | { type: 'BLANK_SCREEN'; commandId?: string }
  | { type: 'SHOW_LOGO'; commandId?: string }
  | { type: 'UNBLANK'; commandId?: string }
  | { type: 'SET_TRANSITION'; transition: TransitionType; commandId?: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<DisplaySettings>; commandId?: string };

export interface HostState {
  displayId: string;
  eventId: string | null;
  currentItemIndex: number;
  currentSectionIndex: number;
  currentSlideIndex: number;
  isBlank: boolean;
  isLogo: boolean;
  transition: TransitionType;
  connectedClients: number;
  lastUpdated: number;
}

export type HostStatus =
  | { type: 'EVENT_READY'; eventId: string }
  | { type: 'EVENT_LOADING'; progress: number }
  | { type: 'EVENT_ERROR'; message: string }
  | { type: 'DISPLAY_INFO'; name: string; settings: DisplaySettings };

// Realtime channel names
export const getDisplayChannel = (displayId: string) => `display:${displayId}`;
export const getPresenceChannel = (churchId: string) => `church:${churchId}:presence`;
