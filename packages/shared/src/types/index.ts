// Re-export generated database types
export type { Database } from './database';

// Domain types
export type Role = 'admin' | 'editor' | 'operator';

export type Permission =
  | 'church:manage'
  | 'church:users'
  | 'songs:read'
  | 'songs:write'
  | 'media:read'
  | 'media:write'
  | 'events:read'
  | 'events:write'
  | 'control:operate'
  | 'integrations:manage';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'church:manage',
    'church:users',
    'songs:read',
    'songs:write',
    'media:read',
    'media:write',
    'events:read',
    'events:write',
    'control:operate',
    'integrations:manage',
  ],
  editor: [
    'songs:read',
    'songs:write',
    'media:read',
    'media:write',
    'events:read',
    'events:write',
    'control:operate',
  ],
  operator: ['songs:read', 'media:read', 'events:read', 'control:operate'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Song content structure (stored in JSONB)
export type SectionType = 'verse' | 'chorus' | 'bridge' | 'pre-chorus' | 'tag' | 'intro' | 'outro';

export interface SongSection {
  type: SectionType;
  label: string;
  lines: string[];
}

export interface SongContent {
  sections: SongSection[];
}

// Event item structure (stored in JSONB)
export type EventItemType = 'song' | 'scripture' | 'announcement' | 'video';

export interface EventItem {
  type: EventItemType;
  id: string;
  arrangement?: number[]; // Section indices for songs
  backgroundId?: string;
}

// Transition types
export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'dissolve';

// Attendance brackets for billing
export type AttendanceBracket = '<100' | '100-500' | '500-1000' | '1000+';
