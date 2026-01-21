/**
 * Theme management utility for dark mode toggle
 * Supports three modes: 'light', 'dark', and 'auto' (system preference)
 */

const THEME_KEY = 'murphys_theme';
const VALID_THEMES = ['light', 'dark', 'auto'];

/**
 * Get the current theme preference from localStorage
 * @returns {'light' | 'dark' | 'auto'} The stored theme or 'auto' if not set
 */
export function getTheme() {
  if (typeof localStorage === 'undefined') {
    return 'auto';
  }
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return VALID_THEMES.includes(stored) ? stored : 'auto';
  } catch {
    // localStorage may be unavailable (private mode, etc.)
    return 'auto';
  }
}

/**
 * Save theme preference to localStorage and apply to DOM
 * @param {'light' | 'dark' | 'auto'} theme - The theme to set
 */
export function setTheme(theme) {
  if (!VALID_THEMES.includes(theme)) {
    return;
  }
  
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // localStorage may be unavailable (private mode, quota exceeded, etc.)
    }
  }
  
  applyTheme(theme);
}

/**
 * Get the effective theme (resolves 'auto' to actual light/dark based on system preference)
 * @param {'light' | 'dark' | 'auto'} theme - The theme preference
 * @returns {'light' | 'dark'} The resolved theme
 */
export function getEffectiveTheme(theme) {
  if (theme === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return theme;
}

/**
 * Apply theme to the DOM by setting data-theme attribute on html element
 * @param {'light' | 'dark' | 'auto'} [theme] - Theme to apply (defaults to stored theme)
 */
export function applyTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }
  
  const themeToApply = theme ?? getTheme();
  
  if (themeToApply === 'auto') {
    // Remove data-theme to let CSS media query handle it
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeToApply);
  }
  
  // Dispatch custom event for components that need to react to theme changes
  document.dispatchEvent(new CustomEvent('themechange', { 
    detail: { 
      theme: themeToApply,
      effectiveTheme: getEffectiveTheme(themeToApply)
    } 
  }));
}

/**
 * Cycle through themes: auto -> light -> dark -> auto
 * @returns {'light' | 'dark' | 'auto'} The new theme after cycling
 */
export function cycleTheme() {
  const current = getTheme();
  const order = ['auto', 'light', 'dark'];
  const currentIndex = order.indexOf(current);
  const nextTheme = order[(currentIndex + 1) % order.length];
  setTheme(nextTheme);
  return nextTheme;
}

/**
 * Get the icon name to display based on current theme
 * @param {'light' | 'dark' | 'auto'} [theme] - Theme to get icon for (defaults to stored theme)
 * @returns {'sun' | 'moon' | 'sunMoon'} Icon name for the theme toggle button
 */
export function getThemeIcon(theme) {
  const currentTheme = theme ?? getTheme();
  switch (currentTheme) {
    case 'light':
      return 'sun';
    case 'dark':
      return 'moon';
    case 'auto':
    default:
      return 'sunMoon';
  }
}

/**
 * Get accessible label for the theme toggle button
 * @param {'light' | 'dark' | 'auto'} [theme] - Current theme (defaults to stored theme)
 * @returns {string} Accessible label describing current state and action
 */
export function getThemeLabel(theme) {
  const currentTheme = theme ?? getTheme();
  switch (currentTheme) {
    case 'light':
      return 'Theme: Light. Click for dark mode';
    case 'dark':
      return 'Theme: Dark. Click for system preference';
    case 'auto':
    default:
      return 'Theme: Auto. Click for light mode';
  }
}

/**
 * Get tooltip text for the theme toggle button
 * @param {'light' | 'dark' | 'auto'} [theme] - Current theme (defaults to stored theme)
 * @returns {string} Short tooltip text describing current theme mode
 */
export function getThemeTooltip(theme) {
  const currentTheme = theme ?? getTheme();
  switch (currentTheme) {
    case 'light':
      return 'Light mode';
    case 'dark':
      return 'Dark mode';
    case 'auto':
    default:
      return 'Auto mode';
  }
}

/**
 * Initialize theme system - apply stored theme and set up system preference listener
 */
export function initTheme() {
  // Apply stored theme immediately
  applyTheme();
  
  // Listen for system preference changes (only matters when in 'auto' mode)
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      // Only react if we're in auto mode
      if (getTheme() === 'auto') {
        // Dispatch event so UI can update if needed
        document.dispatchEvent(new CustomEvent('themechange', { 
          detail: { 
            theme: 'auto',
            effectiveTheme: mediaQuery.matches ? 'dark' : 'light'
          } 
        }));
      }
    };
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    }
  }
}
