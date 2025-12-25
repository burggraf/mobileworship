import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import type { DeviceInfo, DisplaySettings } from '../types';
import { Config } from '../config';

const DISPLAY_ID_KEY = '@mobileworship/display_id';

interface GenerateResponse {
  displayId: string;
  pairingCode: string;
  expiresAt: string;
}

interface VerifyResponse {
  valid: boolean;
  exists?: boolean;
  displayId?: string;
  name?: string;
  churchId?: string;
  settings?: DisplaySettings;
}

export class PairingService {
  private displayId: string | null = null;

  async initialize(): Promise<{ paired: boolean; displayId?: string; name?: string; churchId?: string; settings?: DisplaySettings; needsRepairing?: boolean }> {
    const storedId = await AsyncStorage.getItem(DISPLAY_ID_KEY);

    if (storedId) {
      const verification = await this.verify(storedId);
      if (verification.valid) {
        this.displayId = storedId;
        return {
          paired: true,
          displayId: verification.displayId,
          name: verification.name,
          churchId: verification.churchId,
          settings: verification.settings,
        };
      }
      // Display exists but needs re-pairing (was removed from church)
      if (verification.exists) {
        this.displayId = storedId;
        return { paired: false, displayId: storedId, needsRepairing: true };
      }
      // Display doesn't exist at all - clear storage
      await AsyncStorage.removeItem(DISPLAY_ID_KEY);
    }

    return { paired: false };
  }

  private getDeviceInfo(): DeviceInfo {
    const { width, height } = Dimensions.get('window');
    return {
      platform: Platform.isTV ? 'android-tv' : (Platform.OS as DeviceInfo['platform']),
      version: Platform.Version?.toString() || 'unknown',
      resolution: { width, height },
    };
  }

  async generatePairingCode(): Promise<GenerateResponse> {
    const deviceInfo = this.getDeviceInfo();

    const response = await fetch(`${Config.SUPABASE_FUNCTIONS_URL}/display-pairing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Config.SUPABASE_ANON_KEY}`,
        'apikey': Config.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'generate', deviceInfo }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate pairing code');
    }

    const data: GenerateResponse = await response.json();
    this.displayId = data.displayId;
    // Save immediately so we can reuse this display ID
    await AsyncStorage.setItem(DISPLAY_ID_KEY, data.displayId);
    return data;
  }

  async regeneratePairingCode(displayId: string): Promise<GenerateResponse> {
    const deviceInfo = this.getDeviceInfo();

    const response = await fetch(`${Config.SUPABASE_FUNCTIONS_URL}/display-pairing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Config.SUPABASE_ANON_KEY}`,
        'apikey': Config.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'regenerate', displayId, deviceInfo }),
    });

    if (!response.ok) {
      throw new Error('Failed to regenerate pairing code');
    }

    const data: GenerateResponse = await response.json();
    this.displayId = data.displayId;
    return data;
  }

  async verify(displayId: string): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${Config.SUPABASE_FUNCTIONS_URL}/display-pairing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Config.SUPABASE_ANON_KEY}`,
          'apikey': Config.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'verify', displayId }),
      });

      if (!response.ok) {
        return { valid: false };
      }

      return response.json();
    } catch {
      return { valid: false };
    }
  }

  async savePairing(displayId: string): Promise<void> {
    await AsyncStorage.setItem(DISPLAY_ID_KEY, displayId);
    this.displayId = displayId;
  }

  async clearPairing(): Promise<void> {
    await AsyncStorage.removeItem(DISPLAY_ID_KEY);
    this.displayId = null;
  }

  getDisplayId(): string | null {
    return this.displayId;
  }
}

export const pairingService = new PairingService();
