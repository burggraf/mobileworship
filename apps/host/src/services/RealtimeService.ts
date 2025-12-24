import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ClientCommand, HostState, HostStatus } from '@mobileworship/protocol';
import { getDisplayChannel } from '@mobileworship/protocol';
import Config from 'react-native-config';

type CommandHandler = (command: ClientCommand) => void;
type ClaimHandler = (name: string, churchId: string) => void;

export class RealtimeService {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private displayId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.supabase = createClient(
      Config.SUPABASE_URL || '',
      Config.SUPABASE_ANON_KEY || ''
    );
  }

  async connect(
    displayId: string,
    onCommand: CommandHandler,
    onClaim?: ClaimHandler
  ): Promise<void> {
    this.displayId = displayId;

    this.channel = this.supabase.channel(getDisplayChannel(displayId));

    this.channel.on('broadcast', { event: 'command' }, ({ payload }) => {
      onCommand(payload as ClientCommand);
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

    await this.channel.subscribe();
    this.startHeartbeat();
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
    this.heartbeatInterval = setInterval(async () => {
      if (this.displayId) {
        await this.supabase
          .from('displays')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', this.displayId);
      }
    }, 30000);
  }

  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.displayId = null;
  }
}

export const realtimeService = new RealtimeService();
