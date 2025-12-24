/**
 * Given a hex color, return 'white' or 'black' for best text contrast
 */
export function getContrastColor(hexColor: string): 'white' | 'black' {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using sRGB
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light
  return luminance > 0.5 ? 'black' : 'white';
}
