// packages/ui/src/theme/tokens.ts

/**
 * Brand Color Configuration
 * ========================
 * Edit these values to change the app's primary color scheme.
 * All Gluestack components will automatically use these colors.
 */
export const brandColors = {
  // Primary - Indigo (spiritual, calming)
  primary0: '#ffffff',
  primary50: '#eef2ff',
  primary100: '#e0e7ff',
  primary200: '#c7d2fe',
  primary300: '#a5b4fc',
  primary400: '#818cf8',
  primary500: '#6366f1', // Main brand color
  primary600: '#4f46e5', // Hover/pressed states
  primary700: '#4338ca',
  primary800: '#3730a3',
  primary900: '#312e81',
  primary950: '#1e1b4b',
};

/**
 * Drawer Configuration
 * ====================
 * Customize drawer dimensions and breakpoints.
 */
export const drawerConfig = {
  // Width when expanded
  expandedWidth: 256,
  // Width when collapsed (icons only)
  collapsedWidth: 72,
  // Breakpoints for responsive behavior
  breakpoints: {
    // Below this: drawer hidden, hamburger menu
    mobile: 768,
    // Below this: drawer collapsed by default
    tablet: 1024,
  },
  // Animation duration in ms
  animationDuration: 200,
};

/**
 * Storage Keys
 * ============
 * Keys used for persisting user preferences.
 */
export const storageKeys = {
  drawerCollapsed: 'mobileworship:drawer:collapsed',
  colorMode: 'mobileworship:colorMode',
};
