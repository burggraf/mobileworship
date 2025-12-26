import Zeroconf from 'react-native-zeroconf';

export interface DiscoveredDisplay {
  displayId: string;
  churchId: string;
  name: string;
  host: string;
  port: number;
}

type DiscoveryCallback = (display: DiscoveredDisplay) => void;

/**
 * Discovers Mobile Worship displays on the local network via mDNS
 */
export class MDNSDiscovery {
  private zeroconf: Zeroconf;
  private scanning = false;
  private callback: DiscoveryCallback | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.zeroconf = new Zeroconf();

    this.zeroconf.on('resolved', (service) => {
      if (this.callback && service.name?.startsWith('display-')) {
        const display: DiscoveredDisplay = {
          displayId: service.txt?.displayId || service.name.replace('display-', ''),
          churchId: service.txt?.churchId || '',
          name: service.txt?.name || 'Unknown Display',
          host: service.host || service.addresses?.[0] || '',
          port: service.port || 8765,
        };
        this.callback(display);
      }
    });

    this.zeroconf.on('error', (error) => {
      console.error('mDNS discovery error:', error);
    });
  }

  /**
   * Start scanning for displays
   * @param onDiscovered Callback when a display is found
   * @param timeoutMs How long to scan (default 5 seconds)
   */
  start(onDiscovered: DiscoveryCallback, timeoutMs = 5000): void {
    if (this.scanning) return;

    this.callback = onDiscovered;
    this.scanning = true;

    this.zeroconf.scan('mobileworship', 'tcp');

    this.scanTimeout = setTimeout(() => {
      this.stop();
    }, timeoutMs);
  }

  /**
   * Stop scanning
   */
  stop(): void {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    if (this.scanning) {
      this.zeroconf.stop();
      this.scanning = false;
    }

    this.callback = null;
  }

  /**
   * Scan for a specific display by ID
   * @returns Promise that resolves when found or rejects on timeout
   */
  findDisplay(displayId: string, timeoutMs = 5000): Promise<DiscoveredDisplay> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stop();
        reject(new Error(`Display ${displayId} not found via mDNS`));
      }, timeoutMs);

      this.start((display) => {
        if (display.displayId === displayId) {
          clearTimeout(timeout);
          this.stop();
          resolve(display);
        }
      }, timeoutMs + 1000); // Slightly longer to allow timeout to fire first
    });
  }

  /**
   * Check if currently scanning
   */
  get isScanning(): boolean {
    return this.scanning;
  }
}

export const mdnsDiscovery = new MDNSDiscovery();
