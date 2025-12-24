// packages/shared/src/types/display.ts

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type TextPosition = 'center' | 'bottom' | 'lower-third';
export type FontFamily = 'system' | 'serif' | 'sans-serif';

export interface DisplayMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DisplaySettings {
  fontSize: FontSize;
  textPosition: TextPosition;
  margins: DisplayMargins;
  fontFamily: FontFamily;
  textShadow: boolean;
  overlayOpacity: number;
}

export interface DeviceInfo {
  platform: 'android' | 'android-tv' | 'ios' | 'macos' | 'windows';
  version: string;
  resolution: {
    width: number;
    height: number;
  };
}

export interface Display {
  id: string;
  churchId: string;
  name: string;
  location: string | null;
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  pairedAt: string | null;
  lastSeenAt: string | null;
  deviceInfo: DeviceInfo | null;
  defaultBackgroundId: string | null;
  settings: DisplaySettings;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontSize: 'medium',
  textPosition: 'center',
  margins: { top: 5, bottom: 10, left: 5, right: 5 },
  fontFamily: 'system',
  textShadow: true,
  overlayOpacity: 0.3,
};
