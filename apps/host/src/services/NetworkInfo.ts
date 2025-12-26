import { NetworkInfo as RNNetworkInfo } from 'react-native-network-info';

export interface LocalNetworkInfo {
  ip: string | null;
  broadcast: string | null;
}

/**
 * Get local network information for WebSocket server advertisement
 */
export async function getLocalNetworkInfo(): Promise<LocalNetworkInfo> {
  try {
    const [ip, broadcast] = await Promise.all([
      RNNetworkInfo.getIPV4Address(),
      RNNetworkInfo.getBroadcast(),
    ]);
    return { ip, broadcast };
  } catch (error) {
    console.error('Failed to get network info:', error);
    return { ip: null, broadcast: null };
  }
}

/**
 * Check if we have a valid local network IP (not localhost)
 */
export function isValidLocalIp(ip: string | null): boolean {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === 'localhost') return false;
  // Check for valid private IP ranges
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
  );
}
