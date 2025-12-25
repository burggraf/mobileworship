// Re-export generated database types
export type { Database } from './database';

// Re-export song types from utils
export type {
  ParsedSong,
  SongMetadata,
  SongSection,
  Slide,
} from '../utils/markdown-song';

// Re-export display types
export * from './display';

// Domain types
export type Role = 'admin' | 'editor' | 'operator';

// Membership type for multi-church support
export interface ChurchMembership {
  id: string;
  userId: string;
  churchId: string;
  role: Role;
  lastAccessedAt: string;
  createdAt: string;
  // Joined data
  church?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

// Invitation type
export interface Invitation {
  id: string;
  churchId: string;
  email: string;
  role: Role;
  invitedBy: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  // Joined data
  invitedByUser?: {
    name: string;
  };
  church?: {
    id: string;
    name: string;
  };
}

// Invitation status helper
export type InvitationStatus = 'pending' | 'expired' | 'accepted';

export function getInvitationStatus(invitation: Invitation): InvitationStatus {
  if (invitation.acceptedAt) return 'accepted';
  if (new Date(invitation.expiresAt) < new Date()) return 'expired';
  return 'pending';
}

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

// Event item structure (stored in JSONB)
export type EventItemType = 'song' | 'scripture' | 'announcement' | 'video';

export interface EventItem {
  type: EventItemType;
  id: string;
  arrangement?: string[]; // Section labels for songs
  backgroundId?: string;
}

// Transition types
export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'dissolve';

// Attendance brackets for billing
export type AttendanceBracket = '<100' | '100-500' | '500-1000' | '1000+';
