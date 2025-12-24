import type { ClientCommand, HostState, ConnectionInfo, DiscoveredHost } from './messages';

export interface LocalConnectionOptions {
  onStateUpdate: (state: HostState) => void;
  onConnectionChange: (info: ConnectionInfo) => void;
}

/**
 * Local network connection using WebSocket + mDNS discovery
 * Used when client and host are on the same network for low latency
 */
export class LocalConnection {
  private ws: WebSocket | null = null;
  private options: LocalConnectionOptions;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: LocalConnectionOptions) {
    this.options = options;
  }

  /**
   * Discover hosts on local network using mDNS
   * Implementation depends on platform (react-native-zeroconf, etc.)
   */
  async discoverHosts(): Promise<DiscoveredHost[]> {
    // Platform-specific implementation
    // Will use react-native-zeroconf on mobile
    // Will use bonjour/mdns on desktop
    throw new Error('Not implemented - use platform-specific implementation');
  }

  /**
   * Connect to a discovered host
   */
  async connect(host: DiscoveredHost, authToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.options.onConnectionChange({
        status: 'connecting',
        type: 'local',
        hostId: host.id,
        latency: null,
      });

      const wsUrl = `ws://${host.address}:${host.port}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Send auth message
        this.ws?.send(
          JSON.stringify({
            type: 'AUTH',
            churchId: host.churchId,
            token: authToken,
          })
        );

        this.options.onConnectionChange({
          status: 'connected',
          type: 'local',
          hostId: host.id,
          latency: null,
        });

        // Start ping interval for latency measurement
        this.startPing();
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.options.onConnectionChange({
          status: 'disconnected',
          type: null,
          hostId: null,
          latency: null,
        });
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'STATE_SYNC') {
          this.options.onStateUpdate(message.state);
        }
      };
    });
  }

  /**
   * Send a command to the host
   */
  sendCommand(command: ClientCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'COMMAND', command }));
    }
  }

  /**
   * Disconnect from host
   */
  disconnect(): void {
    this.cleanup();
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 5000);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
