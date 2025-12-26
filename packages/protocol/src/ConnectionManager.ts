import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  ClientCommand,
  HostState,
  LocalAuthMessage,
  LocalAuthResponse,
  ProtocolMessage,
} from './messages';
import { getDisplayChannel, createCommand } from './messages';

export interface DisplayConnection {
  displayId: string;
  localIp: string | null;
  localPort: number;
}

export interface ConnectionManagerOptions {
  supabase: SupabaseClient;
  onStateUpdate: (displayId: string, state: HostState) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
}

export interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected';
  type: 'local' | 'remote' | null;
  displays: Map<string, 'local' | 'remote' | 'disconnected'>;
}

/**
 * Manages connections to multiple displays with local preference
 * Connects to Supabase Realtime immediately, attempts local WebSocket in parallel
 */
export class ConnectionManager {
  private options: ConnectionManagerOptions;
  private displays: DisplayConnection[] = [];
  private localSockets: Map<string, WebSocket> = new Map();
  private remoteChannels: Map<string, RealtimeChannel> = new Map();
  private connectionStatus: ConnectionStatus = {
    state: 'disconnected',
    type: null,
    displays: new Map(),
  };
  private authToken: string | null = null;
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(options: ConnectionManagerOptions) {
    this.options = options;
  }

  /**
   * Connect to displays for an event
   */
  async connect(
    displays: DisplayConnection[],
    authToken: string
  ): Promise<void> {
    this.displays = displays;
    this.authToken = authToken;

    this.updateStatus({ state: 'connecting', type: null });

    // Connect to each display
    await Promise.all(
      displays.map((display) => this.connectToDisplay(display))
    );
  }

  private async connectToDisplay(display: DisplayConnection): Promise<void> {
    // 1. Connect to Supabase Realtime immediately (guaranteed)
    await this.connectRemote(display.displayId);

    // 2. Attempt local WebSocket in parallel
    if (display.localIp) {
      this.connectLocal(display);
    }
  }

  private async connectRemote(displayId: string): Promise<void> {
    const channel = this.options.supabase.channel(getDisplayChannel(displayId), {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        // Only use remote state if no local connection
        if (!this.localSockets.has(displayId)) {
          this.options.onStateUpdate(displayId, payload as HostState);
        }
      })
      .on('broadcast', { event: 'pong' }, () => {
        // Latency measurement could go here
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.updateDisplayStatus(displayId, 'remote');
        }
      });

    this.remoteChannels.set(displayId, channel);
  }

  private connectLocal(display: DisplayConnection): void {
    if (!display.localIp || !this.authToken) return;

    const url = `ws://${display.localIp}:${display.localPort}`;

    try {
      const socket = new WebSocket(url);
      let buffer = '';

      socket.onopen = () => {
        // Send auth message
        const authMessage: LocalAuthMessage = {
          type: 'LOCAL_AUTH',
          token: this.authToken!,
          displayId: display.displayId,
        };
        socket.send(JSON.stringify(authMessage) + '\n');
      };

      socket.onmessage = (event) => {
        buffer += event.data;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message: ProtocolMessage = JSON.parse(line);
            this.handleLocalMessage(display.displayId, socket, message);
          } catch (e) {
            console.error('Failed to parse local message:', e);
          }
        }
      };

      socket.onclose = () => {
        this.localSockets.delete(display.displayId);
        this.updateDisplayStatus(display.displayId, 'remote');
        this.scheduleReconnect(display);
      };

      socket.onerror = () => {
        // Will trigger onclose
      };
    } catch (e) {
      console.error('Failed to create local WebSocket:', e);
    }
  }

  private handleLocalMessage(
    displayId: string,
    socket: WebSocket,
    message: ProtocolMessage
  ): void {
    switch (message.type) {
      case 'LOCAL_AUTH_RESULT':
        const authResult = message as LocalAuthResponse;
        if (authResult.success) {
          this.localSockets.set(displayId, socket);
          this.updateDisplayStatus(displayId, 'local');
          console.log(`Local connection established to ${displayId}`);
        } else {
          console.error('Local auth failed:', authResult.error);
          socket.close();
        }
        break;

      case 'STATE_SYNC':
        this.options.onStateUpdate(displayId, message.state);
        break;

      case 'PONG':
        // Latency measurement
        break;
    }
  }

  private scheduleReconnect(display: DisplayConnection): void {
    // Clear existing timer
    const existing = this.reconnectTimers.get(display.displayId);
    if (existing) clearTimeout(existing);

    // Reconnect after 5 seconds
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(display.displayId);
      if (display.localIp && !this.localSockets.has(display.displayId)) {
        this.connectLocal(display);
      }
    }, 5000);

    this.reconnectTimers.set(display.displayId, timer);
  }

  /**
   * Send a command to all displays
   */
  sendCommand(command: Omit<ClientCommand, 'commandId'>): void {
    const fullCommand = createCommand(command);

    for (const display of this.displays) {
      const localSocket = this.localSockets.get(display.displayId);

      if (localSocket?.readyState === WebSocket.OPEN) {
        // Prefer local
        localSocket.send(
          JSON.stringify({ type: 'COMMAND', command: fullCommand }) + '\n'
        );
      } else {
        // Fallback to remote
        const channel = this.remoteChannels.get(display.displayId);
        channel?.send({
          type: 'broadcast',
          event: 'command',
          payload: fullCommand,
        });
      }
    }
  }

  /**
   * Disconnect from all displays
   */
  async disconnect(): Promise<void> {
    // Clear reconnect timers
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    // Close local sockets
    this.localSockets.forEach((socket) => socket.close());
    this.localSockets.clear();

    // Unsubscribe from remote channels
    await Promise.all(
      Array.from(this.remoteChannels.values()).map((channel) =>
        channel.unsubscribe()
      )
    );
    this.remoteChannels.clear();

    this.displays = [];
    this.authToken = null;
    this.updateStatus({ state: 'disconnected', type: null });
  }

  private updateDisplayStatus(
    displayId: string,
    status: 'local' | 'remote' | 'disconnected'
  ): void {
    this.connectionStatus.displays.set(displayId, status);
    this.recalculateOverallStatus();
  }

  private updateStatus(partial: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...partial };
    this.options.onConnectionChange(this.connectionStatus);
  }

  private recalculateOverallStatus(): void {
    const statuses = Array.from(this.connectionStatus.displays.values());

    if (statuses.length === 0) {
      this.updateStatus({ state: 'disconnected', type: null });
      return;
    }

    const hasLocal = statuses.includes('local');
    const hasRemote = statuses.includes('remote');
    const allDisconnected = statuses.every((s) => s === 'disconnected');

    if (allDisconnected) {
      this.updateStatus({ state: 'disconnected', type: null });
    } else {
      // Show worst-case: if any is remote-only, show remote
      this.updateStatus({
        state: 'connected',
        type: hasLocal && !hasRemote ? 'local' : hasRemote ? 'remote' : null,
      });
    }
  }

  get status(): ConnectionStatus {
    return this.connectionStatus;
  }
}
