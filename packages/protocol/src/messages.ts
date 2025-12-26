import type { DisplaySettings } from '@mobileworship/shared';

// Transition types
export type TransitionType = 'cut' | 'fade' | 'slide';

// Client → Host commands
// All commands include commandId for deduplication across local/remote channels
export type ClientCommand =
  | { type: 'LOAD_EVENT'; eventId: string; commandId: string }
  | { type: 'UNLOAD_EVENT'; commandId: string }
  | { type: 'GOTO_SLIDE'; slideIndex: number; commandId: string }
  | { type: 'GOTO_SECTION'; sectionIndex: number; commandId: string }
  | { type: 'GOTO_ITEM'; itemIndex: number; commandId: string }
  | { type: 'NEXT_SLIDE'; commandId: string }
  | { type: 'PREV_SLIDE'; commandId: string }
  | { type: 'BLANK_SCREEN'; commandId: string }
  | { type: 'SHOW_LOGO'; commandId: string }
  | { type: 'UNBLANK'; commandId: string }
  | { type: 'SET_TRANSITION'; transition: TransitionType; commandId: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<DisplaySettings>; commandId: string };

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

// Local WebSocket authentication (for direct connections)
export interface LocalAuthMessage {
  type: 'LOCAL_AUTH';
  token: string;      // Supabase JWT
  displayId: string;  // Which display client wants to control
}

export type LocalAuthError = 'INVALID_TOKEN' | 'WRONG_CHURCH' | 'DISPLAY_MISMATCH';

export interface LocalAuthResponse {
  type: 'LOCAL_AUTH_RESULT';
  success: boolean;
  error?: LocalAuthError;
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
  | LocalAuthMessage
  | LocalAuthResponse
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
export const getPresenceChannel = (churchId: string) => `church:${churchId}:presence`;

// Presence state for displays
export interface DisplayPresence {
  displayId: string;
  name: string;
  online_at: string;
}

// Helper to generate a unique command ID
export function generateCommandId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create a command with auto-generated ID
export function createCommand<T extends Omit<ClientCommand, 'commandId'>>(
  command: T
): T & { commandId: string } {
  return { ...command, commandId: generateCommandId() };
}
