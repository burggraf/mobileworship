import type { ReactNode } from 'react';

export interface SlidePreviewProps {
  lines: string[];
  backgroundUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Preview component for a single slide
 * Platform-specific styling should be handled via className/style props
 */
export function SlidePreview({
  lines,
  backgroundUrl,
  backgroundColor = '#000000',
  textColor = '#ffffff',
  className,
  style,
}: SlidePreviewProps): ReactNode {
  // This is a placeholder - actual implementation will differ per platform
  // Web: Uses Tailwind CSS
  // RN: Uses StyleSheet
  return null;
}
