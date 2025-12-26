import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ClientCommand, HostState, HostStatus } from '../types';
import { getDisplayChannel } from '../types';
import { Config } from '../config';

type CommandHandler = (command: ClientCommand) => void;
type ClaimHandler = (name: string, churchId: string) => void;
type RemovedHandler = () => void;

export class RealtimeService {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private displayId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      this.supabase = createClient(
        Config.SUPABASE_URL,
        Config.SUPABASE_ANON_KEY
      );
    }
    return this.supabase;
  }

  async connect(
    displayId: string,
    onCommand: CommandHandler,
    onClaim?: ClaimHandler,
    onRemoved?: RemovedHandler
  ): Promise<void> {
    this.displayId = displayId;

    const supabase = this.getSupabase();
    this.channel = supabase.channel(getDisplayChannel(displayId));

    this.channel.on('broadcast', { event: 'command' }, ({ payload }) => {
      onCommand(payload as ClientCommand);
    });

    // Respond to ping requests for connection testing
    this.channel.on('broadcast', { event: 'ping' }, () => {
      this.channel?.send({
        type: 'broadcast',
        event: 'pong',
        payload: { timestamp: Date.now() },
      });
    });

    if (onClaim) {
      this.channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'displays',
          filter: `id=eq.${displayId}`,
        },
        (payload) => {
          const newRow = payload.new as { paired_at?: string; name?: string; church_id?: string };
          const oldRow = payload.old as { paired_at?: string };
          if (newRow.paired_at && !oldRow.paired_at) {
            onClaim(newRow.name || 'Display', newRow.church_id || '');
          }
        }
      );
    }

    if (onRemoved) {
      // Note: DELETE events cannot be filtered in Supabase Realtime
      // We must listen to all deletes and check the ID in the callback
      this.channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'displays',
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (oldRow.id === displayId) {
            onRemoved();
          }
        }
      );
    }

    await this.channel.subscribe();

    // Send immediate heartbeat on connect
    await this.sendHeartbeat();
    this.startHeartbeat();
  }

  private async sendHeartbeat(): Promise<void> {
    if (this.displayId) {
      try {
        const supabase = this.getSupabase();
        await supabase
          .from('displays')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', this.displayId);
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }
  }

  broadcastState(state: HostState): void {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'state',
        payload: state,
      });
    }
  }

  broadcastStatus(status: HostStatus): void {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'status',
        payload: status,
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  async disconnect(sendOfflineSignal: boolean = false): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Only mark as offline when explicitly requested (e.g., user exits app)
    if (sendOfflineSignal && this.displayId) {
      try {
        const supabase = this.getSupabase();
        // Set to 2 minutes ago so isDisplayOnline returns false immediately
        const offlineTime = new Date(Date.now() - 120000).toISOString();
        await supabase
          .from('displays')
          .update({ last_seen_at: offlineTime })
          .eq('id', this.displayId);
      } catch (error) {
        console.error('Failed to mark offline:', error);
      }
    }

    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.displayId = null;
  }
}

export const realtimeService = new RealtimeService();
