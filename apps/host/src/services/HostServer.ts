import type { ClientCommand, HostState, ProtocolMessage } from '@mobileworship/protocol';

interface HostServerOptions {
  port: number;
  onCommand: (command: ClientCommand) => void;
  onClientConnect: () => void;
  onClientDisconnect: () => void;
}

/**
 * WebSocket server for local network connections
 * Note: This is a placeholder - actual implementation requires
 * platform-specific native modules for WebSocket server functionality
 */
export class HostServer {
  private options: HostServerOptions;
  private clients: Set<WebSocket> = new Set();
  private state: HostState = {
    eventId: '',
    currentItemIndex: 0,
    currentSectionIndex: 0,
    currentSlideIndex: 0,
    isBlank: false,
    isLogo: true,
    transition: 'fade',
    connectedClients: 0,
  };

  constructor(options: HostServerOptions) {
    this.options = options;
  }

  /**
   * Start the WebSocket server
   * Platform-specific implementation needed
   */
  start(): void {
    // TODO: Implement platform-specific WebSocket server
    // For React Native, this requires a native module
    // Options:
    // - react-native-tcp-socket for TCP
    // - Native module wrapper around platform WebSocket APIs
    console.log(`Host server starting on port ${this.options.port}`);
  }

  /**
   * Stop the server and disconnect all clients
   */
  stop(): void {
    this.clients.forEach((client) => client.close());
    this.clients.clear();
    console.log('Host server stopped');
  }

  /**
   * Handle incoming message from a client
   */
  private handleMessage(client: WebSocket, data: string): void {
    try {
      const message: ProtocolMessage = JSON.parse(data);

      switch (message.type) {
        case 'AUTH':
          // Validate auth and add client
          this.clients.add(client);
          this.options.onClientConnect();
          this.sendState(client);
          break;

        case 'COMMAND':
          this.options.onCommand(message.command);
          this.broadcastState();
          break;

        case 'PING':
          client.send(JSON.stringify({ type: 'PONG' }));
          break;
      }
    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  }

  /**
   * Send current state to a specific client
   */
  private sendState(client: WebSocket): void {
    const message: ProtocolMessage = {
      type: 'STATE_SYNC',
      state: {
        ...this.state,
        connectedClients: this.clients.size,
      },
    };
    client.send(JSON.stringify(message));
  }

  /**
   * Broadcast current state to all connected clients
   */
  broadcastState(): void {
    this.state.connectedClients = this.clients.size;
    const message: ProtocolMessage = {
      type: 'STATE_SYNC',
      state: this.state,
    };
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Update internal state
   */
  setState(update: Partial<HostState>): void {
    this.state = { ...this.state, ...update };
    this.broadcastState();
  }
}
