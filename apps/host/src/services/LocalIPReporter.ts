import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getLocalNetworkInfo, isValidLocalIp } from './NetworkInfo';
import { Config } from '../config';

const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reports local IP address to Supabase for client discovery
 */
export class LocalIPReporter {
  private supabase: SupabaseClient;
  private displayId: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.supabase = createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY);
  }

  async start(displayId: string, port: number): Promise<void> {
    this.displayId = displayId;

    // Report immediately
    await this.reportIP(port);

    // Then report periodically
    this.intervalId = setInterval(() => {
      this.reportIP(port);
    }, UPDATE_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear IP on stop
    if (this.displayId) {
      try {
        await this.supabase
          .from('displays')
          .update({
            local_ip: null,
            local_port: null,
            local_ip_updated_at: null,
          })
          .eq('id', this.displayId);
      } catch (e) {
        console.error('LocalIPReporter: Failed to clear IP:', e);
      }
    }

    this.displayId = null;
  }

  private async reportIP(port: number): Promise<void> {
    if (!this.displayId) return;

    const networkInfo = await getLocalNetworkInfo();

    if (!isValidLocalIp(networkInfo.ip)) {
      console.log('LocalIPReporter: No valid local IP to report');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('displays')
        .update({
          local_ip: networkInfo.ip,
          local_port: port,
          local_ip_updated_at: new Date().toISOString(),
        })
        .eq('id', this.displayId);

      if (error) {
        console.error('LocalIPReporter: Failed to update IP:', error);
      } else {
        console.log(`LocalIPReporter: Reported IP ${networkInfo.ip}:${port}`);
      }
    } catch (e) {
      console.error('LocalIPReporter: Error updating IP:', e);
    }
  }

  /**
   * Force an immediate IP report (e.g., on network change)
   */
  async forceReport(port: number): Promise<void> {
    await this.reportIP(port);
  }
}

export const localIPReporter = new LocalIPReporter();
