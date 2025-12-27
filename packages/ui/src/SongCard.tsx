import type { ReactNode } from 'react';

export interface SongCardProps {
  title: string;
  author?: string;
  lastUsed?: Date;
  tags?: string[];
  onPress?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Card component for displaying a song in the library
 */
export function SongCard(_props: SongCardProps): ReactNode {
  // Placeholder - implemented per platform
  return null;
}
