import Zeroconf from 'react-native-zeroconf';

export interface MDNSServiceConfig {
  displayId: string;
  churchId: string;
  displayName: string;
  port: number;
}

/**
 * Advertises the host display on the local network via mDNS/Bonjour
 * Service type: _mobileworship._tcp
 */
export class MDNSService {
  private zeroconf: Zeroconf;
  private isPublished = false;
  private config: MDNSServiceConfig | null = null;

  constructor() {
    this.zeroconf = new Zeroconf();
  }

  /**
   * Start advertising the display service
   */
  async publish(config: MDNSServiceConfig): Promise<void> {
    if (this.isPublished) {
      await this.unpublish();
    }

    this.config = config;

    try {
      // Service name format: display-{displayId}
      const serviceName = `display-${config.displayId}`;

      // Note: react-native-zeroconf's publishService API varies by platform
      // On Android, TXT records may not be fully supported
      this.zeroconf.publishService(
        'mobileworship',
        'tcp',
        'local.',
        serviceName,
        config.port
      );

      this.isPublished = true;
      console.log(`mDNS: Published ${serviceName} on port ${config.port}`);
    } catch (error) {
      console.error('mDNS: Failed to publish service:', error);
      throw error;
    }
  }

  /**
   * Stop advertising the service
   */
  async unpublish(): Promise<void> {
    if (!this.isPublished) return;

    try {
      this.zeroconf.unpublishService(`display-${this.config?.displayId}`);
      this.isPublished = false;
      console.log('mDNS: Unpublished service');
    } catch (error) {
      console.error('mDNS: Failed to unpublish:', error);
    }
  }

  /**
   * Check if currently advertising
   */
  get advertising(): boolean {
    return this.isPublished;
  }
}

export const mdnsService = new MDNSService();
