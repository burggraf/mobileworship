import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import type { DeviceInfo, DisplaySettings } from '@mobileworship/shared';
import Config from 'react-native-config';

const DISPLAY_ID_KEY = '@mobileworship/display_id';

interface GenerateResponse {
  displayId: string;
  pairingCode: string;
  expiresAt: string;
}

interface VerifyResponse {
  valid: boolean;
  displayId?: string;
  name?: string;
  churchId?: string;
  settings?: DisplaySettings;
}

export class PairingService {
  private displayId: string | null = null;
  private supabaseFunctionsUrl: string;

  constructor() {
    this.supabaseFunctionsUrl = (Config.SUPABASE_URL || '') + '/functions/v1';
  }

  async initialize(): Promise<{ paired: boolean; displayId?: string; name?: string; churchId?: string; settings?: DisplaySettings }> {
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
      await AsyncStorage.removeItem(DISPLAY_ID_KEY);
    }

    return { paired: false };
  }

  async generatePairingCode(): Promise<GenerateResponse> {
    const { width, height } = Dimensions.get('window');
    const deviceInfo: DeviceInfo = {
      platform: Platform.isTV ? 'android-tv' : (Platform.OS as DeviceInfo['platform']),
      version: Platform.Version?.toString() || 'unknown',
      resolution: { width, height },
    };

    const response = await fetch(`${this.supabaseFunctionsUrl}/display-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', deviceInfo }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate pairing code');
    }

    const data: GenerateResponse = await response.json();
    this.displayId = data.displayId;
    return data;
  }

  async verify(displayId: string): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${this.supabaseFunctionsUrl}/display-pairing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
