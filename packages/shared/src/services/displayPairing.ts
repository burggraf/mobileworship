// packages/shared/src/services/displayPairing.ts
import type { DeviceInfo } from '../types/display';

export interface ClaimDisplayResult {
  displayId: string;
  name: string;
  churchId: string;
}

export interface ValidateCodeResult {
  valid: boolean;
  displayId?: string;
  deviceInfo?: DeviceInfo;
}

export async function claimDisplay(
  supabaseUrl: string,
  accessToken: string,
  code: string,
  name: string,
  location?: string
): Promise<ClaimDisplayResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/display-pairing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'claim',
      code,
      name,
      location,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to claim display');
  }

  return response.json();
}

export function parseQRCode(qrValue: string): string | null {
  // Expected format: mobileworship://pair?code=123456
  try {
    const url = new URL(qrValue);
    if (url.protocol === 'mobileworship:' && url.pathname === '//pair') {
      const code = url.searchParams.get('code');
      if (code && /^\d{6}$/.test(code)) {
        return code;
      }
    }
  } catch {
    // Not a valid URL, check if it's just a 6-digit code
    if (/^\d{6}$/.test(qrValue)) {
      return qrValue;
    }
  }
  return null;
}
