import TcpSocket from 'react-native-tcp-socket';
import type {
  ClientCommand,
  HostState,
  ProtocolMessage,
  LocalAuthMessage,
  LocalAuthResponse,
} from '@mobileworship/protocol';

interface HostServerOptions {
  port: number;
  displayId: string;
  churchId: string;
  onCommand: (command: ClientCommand) => void;
  onClientConnect: () => void;
  onClientDisconnect: () => void;
}

interface AuthenticatedClient {
  socket: TcpSocket.Socket;
  authenticated: boolean;
  buffer: string;
}

/**
 * TCP server for local network connections from client apps
 * Uses newline-delimited JSON message framing
 */
export class HostServer {
  private server: TcpSocket.Server | null = null;
  private clients: Map<number, AuthenticatedClient> = new Map();
  private options: HostServerOptions;
  private state: HostState;
  private nextClientId = 1;

  constructor(options: HostServerOptions) {
    this.options = options;
    this.state = {
      displayId: options.displayId,
      eventId: null,
      currentItemIndex: 0,
      currentSectionIndex: 0,
      currentSlideIndex: 0,
      isBlank: false,
      isLogo: true,
      transition: 'fade',
      connectedClients: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Start the TCP server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = TcpSocket.createServer((socket) => {
          this.handleNewClient(socket);
        });

        this.server.listen({ port: this.options.port, host: '0.0.0.0' }, () => {
          console.log(`HostServer: Listening on port ${this.options.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('HostServer error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server and disconnect all clients
   */
  stop(): void {
    this.clients.forEach((client) => {
      try {
        client.socket.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    this.clients.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
    console.log('HostServer: Stopped');
  }

  private handleNewClient(socket: TcpSocket.Socket): void {
    const clientId = this.nextClientId++;
    const client: AuthenticatedClient = {
      socket,
      authenticated: false,
      buffer: '',
    };
    this.clients.set(clientId, client);
    console.log(`HostServer: Client ${clientId} connected`);

    socket.on('data', (data) => {
      client.buffer += data.toString();
      this.processBuffer(clientId, client);
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      if (client.authenticated) {
        this.options.onClientDisconnect();
        this.updateClientCount();
      }
      console.log(`HostServer: Client ${clientId} disconnected`);
    });

    socket.on('error', (error) => {
      console.error(`HostServer: Client ${clientId} error:`, error);
      this.clients.delete(clientId);
    });
  }

  private processBuffer(clientId: number, client: AuthenticatedClient): void {
    // Messages are newline-delimited JSON
    const lines = client.buffer.split('\n');
    client.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message: ProtocolMessage = JSON.parse(line);
        this.handleMessage(clientId, client, message);
      } catch (e) {
        console.error('HostServer: Failed to parse message:', e);
      }
    }
  }

  private handleMessage(
    clientId: number,
    client: AuthenticatedClient,
    message: ProtocolMessage
  ): void {
    if (message.type === 'LOCAL_AUTH') {
      this.handleAuth(clientId, client, message as LocalAuthMessage);
      return;
    }

    if (!client.authenticated) {
      console.log(
        `HostServer: Rejecting message from unauthenticated client ${clientId}`
      );
      return;
    }

    switch (message.type) {
      case 'COMMAND':
        this.options.onCommand(message.command);
        break;
      case 'PING':
        this.send(client.socket, { type: 'PONG' });
        break;
    }
  }

  private handleAuth(
    clientId: number,
    client: AuthenticatedClient,
    message: LocalAuthMessage
  ): void {
    // Decode JWT to extract church_id (no signature verification for local network)
    // In local network context, we trust the token's claims
    let tokenChurchId: string | null = null;
    try {
      const payload = JSON.parse(atob(message.token.split('.')[1]));
      // Supabase JWT has user metadata in app_metadata or user_metadata
      // The church_id may be in the custom claims
      tokenChurchId = payload.church_id || payload.user_metadata?.church_id || null;
    } catch (e) {
      console.error('HostServer: Failed to decode JWT:', e);
    }

    // Verify displayId matches this host
    if (message.displayId !== this.options.displayId) {
      const response: LocalAuthResponse = {
        type: 'LOCAL_AUTH_RESULT',
        success: false,
        error: 'DISPLAY_MISMATCH',
      };
      this.send(client.socket, response);
      return;
    }

    // Optional: Verify church_id if available in token
    // For now, accept if displayId matches (church verification via display ownership)
    client.authenticated = true;
    this.options.onClientConnect();
    this.updateClientCount();

    const response: LocalAuthResponse = {
      type: 'LOCAL_AUTH_RESULT',
      success: true,
    };
    this.send(client.socket, response);

    // Send current state to newly authenticated client
    this.sendState(client.socket);
    console.log(`HostServer: Client ${clientId} authenticated`);
  }

  private send(socket: TcpSocket.Socket, message: ProtocolMessage): void {
    try {
      socket.write(JSON.stringify(message) + '\n');
    } catch (e) {
      console.error('HostServer: Failed to send message:', e);
    }
  }

  private sendState(socket: TcpSocket.Socket): void {
    this.send(socket, {
      type: 'STATE_SYNC',
      state: { ...this.state, connectedClients: this.getAuthenticatedCount() },
    });
  }

  /**
   * Broadcast current state to all connected clients
   */
  broadcastState(): void {
    this.state.connectedClients = this.getAuthenticatedCount();
    const message: ProtocolMessage = { type: 'STATE_SYNC', state: this.state };
    const data = JSON.stringify(message) + '\n';

    this.clients.forEach((client) => {
      if (client.authenticated) {
        try {
          client.socket.write(data);
        } catch (e) {
          // Ignore write errors (client may have disconnected)
        }
      }
    });
  }

  /**
   * Update internal state and broadcast to clients
   */
  setState(update: Partial<HostState>): void {
    this.state = { ...this.state, ...update, lastUpdated: Date.now() };
    this.broadcastState();
  }

  private getAuthenticatedCount(): number {
    let count = 0;
    this.clients.forEach((c) => {
      if (c.authenticated) count++;
    });
    return count;
  }

  private updateClientCount(): void {
    this.state.connectedClients = this.getAuthenticatedCount();
  }

  /**
   * Get the number of authenticated clients
   */
  get connectedClients(): number {
    return this.getAuthenticatedCount();
  }
}
