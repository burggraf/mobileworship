import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ClientCommand, HostState, HostStatus } from '../types';
import { getDisplayChannel, getPresenceChannel } from '../types';
import { Config } from '../config';

type CommandHandler = (command: ClientCommand) => void;
type ClaimHandler = (name: string, churchId: string) => void;
type RemovedHandler = () => void;

export class RealtimeService {
  private supabase: SupabaseClient | null = null;
  private commandChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private displayId: string | null = null;
  private displayName: string | null = null;

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
    churchId: string,
    displayName: string,
    onCommand: CommandHandler,
    onClaim?: ClaimHandler,
    onRemoved?: RemovedHandler
  ): Promise<void> {
    this.displayId = displayId;
    this.displayName = displayName;

    const supabase = this.getSupabase();

    // Command channel for receiving commands and broadcasting state
    this.commandChannel = supabase.channel(getDisplayChannel(displayId));

    this.commandChannel.on('broadcast', { event: 'command' }, ({ payload }) => {
      onCommand(payload as ClientCommand);
    });

    // Respond to ping requests for connection testing
    this.commandChannel.on('broadcast', { event: 'ping' }, () => {
      this.commandChannel?.send({
        type: 'broadcast',
        event: 'pong',
        payload: { timestamp: Date.now() },
      });
    });

    if (onClaim) {
      this.commandChannel.on(
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
      this.commandChannel.on(
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

    await this.commandChannel.subscribe();

    // Presence channel for online/offline status (only if we have a churchId)
    if (churchId) {
      this.presenceChannel = supabase.channel(getPresenceChannel(churchId));

      await this.presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.presenceChannel?.track({
            displayId,
            name: displayName,
            online_at: new Date().toISOString(),
          });
        }
      });

      // Update last_seen_at once on connect for historical purposes
      await this.updateLastSeen();
    }
  }

  private async updateLastSeen(): Promise<void> {
    if (this.displayId) {
      try {
        const supabase = this.getSupabase();
        await supabase
          .from('displays')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', this.displayId);
      } catch (error) {
        console.error('Failed to update last_seen_at:', error);
      }
    }
  }

  broadcastState(state: HostState): void {
    if (this.commandChannel) {
      this.commandChannel.send({
        type: 'broadcast',
        event: 'state',
        payload: state,
      });
    }
  }

  broadcastStatus(status: HostStatus): void {
    if (this.commandChannel) {
      this.commandChannel.send({
        type: 'broadcast',
        event: 'status',
        payload: status,
      });
    }
  }

  async disconnect(): Promise<void> {
    // Mark as offline in database (instant offline signal)
    if (this.displayId) {
      try {
        const supabase = this.getSupabase();
        const offlineTime = new Date(Date.now() - 120000).toISOString();
        await supabase
          .from('displays')
          .update({ last_seen_at: offlineTime })
          .eq('id', this.displayId);
      } catch (error) {
        console.error('Failed to mark offline:', error);
      }
    }

    // Clean up presence channel
    if (this.presenceChannel) {
      try {
        await this.presenceChannel.untrack();
      } catch (e) {
        // Ignore errors
      }
      this.presenceChannel.unsubscribe();
      this.presenceChannel = null;
    }

    if (this.commandChannel) {
      this.commandChannel.unsubscribe();
      this.commandChannel = null;
    }

    this.displayId = null;
    this.displayName = null;
  }
}

export const realtimeService = new RealtimeService();
