import type { DisplaySettings } from '@mobileworship/shared';

// Transition types
export type TransitionType = 'cut' | 'fade' | 'slide';

// Client → Host commands
export type ClientCommand =
  | { type: 'LOAD_EVENT'; eventId: string }
  | { type: 'UNLOAD_EVENT' }
  | { type: 'GOTO_SLIDE'; slideIndex: number }
  | { type: 'GOTO_SECTION'; sectionIndex: number }
  | { type: 'GOTO_ITEM'; itemIndex: number }
  | { type: 'NEXT_SLIDE' }
  | { type: 'PREV_SLIDE' }
  | { type: 'BLANK_SCREEN' }
  | { type: 'SHOW_LOGO' }
  | { type: 'UNBLANK' }
  | { type: 'SET_TRANSITION'; transition: TransitionType }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<DisplaySettings> };

// Host → Client state updates
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

// Host → Client status messages
export type HostStatus =
  | { type: 'EVENT_READY'; eventId: string }
  | { type: 'EVENT_LOADING'; progress: number }
  | { type: 'EVENT_ERROR'; message: string }
  | { type: 'DISPLAY_INFO'; name: string; settings: DisplaySettings };

// Authentication message
export interface AuthMessage {
  type: 'AUTH';
  churchId: string;
  userId: string;
  token: string;
}

// State sync message
export interface StateSyncMessage {
  type: 'STATE_SYNC';
  state: HostState;
}

// Status message
export interface StatusMessage {
  type: 'STATUS';
  status: HostStatus;
}

// Connection events
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type ConnectionType = 'local' | 'remote';

export interface ConnectionInfo {
  status: ConnectionStatus;
  type: ConnectionType | null;
  hostId: string | null;
  latency: number | null;
}

// Message wrapper for transport
export type ProtocolMessage =
  | AuthMessage
  | StateSyncMessage
  | StatusMessage
  | { type: 'COMMAND'; command: ClientCommand }
  | { type: 'PING' }
  | { type: 'PONG' };

// Host discovery (for local network)
export interface DiscoveredHost {
  id: string;
  name: string;
  address: string;
  port: number;
  churchId: string;
}

// Realtime channel names
export const getDisplayChannel = (displayId: string) => `display:${displayId}`;
