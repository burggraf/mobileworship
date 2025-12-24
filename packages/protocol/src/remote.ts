import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { ClientCommand, HostState, ConnectionInfo } from './messages';

export interface RemoteConnectionOptions {
  supabase: SupabaseClient;
  onStateUpdate: (state: HostState) => void;
  onConnectionChange: (info: ConnectionInfo) => void;
}

/**
 * Remote connection using Supabase Realtime
 * Used when client and host are on different networks
 */
export class RemoteConnection {
  private channel: RealtimeChannel | null = null;
  private options: RemoteConnectionOptions;
  private hostId: string | null = null;

  constructor(options: RemoteConnectionOptions) {
    this.options = options;
  }

  /**
   * Connect to a host via Supabase Realtime channel
   */
  async connect(hostId: string): Promise<void> {
    this.hostId = hostId;
    const channelName = `host:${hostId}`;

    this.options.onConnectionChange({
      status: 'connecting',
      type: 'remote',
      hostId,
      latency: null,
    });

    this.channel = this.options.supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: 'client' },
      },
    });

    this.channel
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        this.options.onStateUpdate(payload as HostState);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.options.onConnectionChange({
            status: 'connected',
            type: 'remote',
            hostId,
            latency: null,
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.options.onConnectionChange({
            status: 'disconnected',
            type: null,
            hostId: null,
            latency: null,
          });
        }
      });
  }

  /**
   * Send a command to the host via broadcast
   */
  sendCommand(command: ClientCommand): void {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'command',
        payload: command,
      });
    }
  }

  /**
   * Disconnect from host
   */
  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.hostId = null;
    this.options.onConnectionChange({
      status: 'disconnected',
      type: null,
      hostId: null,
      latency: null,
    });
  }
}
