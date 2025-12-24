import type { TransitionType } from '@mobileworship/shared';

// Client → Host commands
export type ClientCommand =
  | { type: 'GOTO_SLIDE'; slideIndex: number }
  | { type: 'GOTO_SECTION'; sectionIndex: number }
  | { type: 'GOTO_ITEM'; itemIndex: number }
  | { type: 'NEXT_SLIDE' }
  | { type: 'PREV_SLIDE' }
  | { type: 'BLANK_SCREEN' }
  | { type: 'SHOW_LOGO' }
  | { type: 'UNBLANK' }
  | { type: 'SET_TRANSITION'; transition: TransitionType };

// Host → Client state updates
export interface HostState {
  eventId: string;
  currentItemIndex: number;
  currentSectionIndex: number;
  currentSlideIndex: number;
  isBlank: boolean;
  isLogo: boolean;
  transition: TransitionType;
  connectedClients: number;
}

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
