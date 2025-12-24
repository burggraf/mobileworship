import type { ReactNode } from 'react';

export interface EventCardProps {
  title: string;
  scheduledAt?: Date;
  itemCount: number;
  status: 'draft' | 'ready' | 'live' | 'completed';
  onPress?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Card component for displaying an event/service
 */
export function EventCard({
  title,
  scheduledAt,
  itemCount,
  status,
  onPress,
  className,
  style,
}: EventCardProps): ReactNode {
  // Placeholder - implemented per platform
  return null;
}
