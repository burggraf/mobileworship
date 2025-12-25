// packages/shared/src/services/displayPairing.ts
import type { SupabaseClient } from '@supabase/supabase-js';
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
  supabase: SupabaseClient,
  code: string,
  name: string,
  location?: string
): Promise<ClaimDisplayResult> {
  const { data, error } = await supabase.functions.invoke('display-pairing', {
    body: {
      action: 'claim',
      code,
      name,
      location,
    },
  });

  if (error) {
    console.error('Claim display error:', error);
    throw new Error(error.message || 'Failed to claim display');
  }

  if (data?.error) {
    console.error('Claim display error:', data.error);
    throw new Error(data.error);
  }

  return data;
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
