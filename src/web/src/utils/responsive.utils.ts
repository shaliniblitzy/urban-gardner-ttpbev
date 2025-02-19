import { breakpoints } from '../theme/breakpoints';

/**
 * Interface defining viewport dimensions and related metrics
 * @version 1.0.0
 */
interface ViewportDimensions {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  aspectRatio: number;
}

/**
 * Default viewport dimensions for SSR environment
 */
const DEFAULT_VIEWPORT: ViewportDimensions = {
  width: 0,
  height: 0,
  orientation: 'portrait',
  aspectRatio: 0,
};

/**
 * Memoization decorator for caching function results
 * @param target - Target function
 * @param context - Decorator context
 */
function memoize(target: Function, context: ClassMethodDecoratorContext) {
  const cache = new Map();
  
  return function (...args: any[]) {
    const key = JSON.stringify(args);
    if (!cache.has(key)) {
      cache.set(key, target.apply(this, args));
    }
    return cache.get(key);
  };
}

/**
 * Retrieves current viewport dimensions with SSR support
 * @returns ViewportDimensions object containing width, height, orientation, and aspectRatio
 */
export const getViewportDimensions = (): ViewportDimensions => {
  // Check for SSR environment
  if (typeof window === 'undefined') {
    return DEFAULT_VIEWPORT;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const orientation = height > width ? 'portrait' : 'landscape';
  const aspectRatio = Number((width / height).toFixed(2));

  return {
    width,
    height,
    orientation,
    aspectRatio,
  };
};

/**
 * Checks if current viewport width matches small screen criteria
 * @param width - Viewport width to check
 * @returns boolean indicating if screen is small
 */
export const isSmallScreen = (width: number): boolean => {
  if (width < 0) {
    throw new Error('Width must be a positive number');
  }
  return width < breakpoints.small;
};

/**
 * Checks if current viewport width matches medium screen criteria
 * @param width - Viewport width to check
 * @returns boolean indicating if screen is medium
 */
export const isMediumScreen = (width: number): boolean => {
  if (width < 0) {
    throw new Error('Width must be a positive number');
  }
  return width >= breakpoints.small && width < breakpoints.medium;
};

/**
 * Checks if current viewport width matches large screen criteria
 * @param width - Viewport width to check
 * @returns boolean indicating if screen is large
 */
export const isLargeScreen = (width: number): boolean => {
  if (width < 0) {
    throw new Error('Width must be a positive number');
  }
  return width >= breakpoints.large;
};

/**
 * Determines current viewport orientation
 * @returns 'portrait' or 'landscape' based on viewport dimensions
 */
export const getOrientation = (): 'portrait' | 'landscape' => {
  const { width, height } = getViewportDimensions();
  return height > width ? 'portrait' : 'landscape';
};

/**
 * Calculates current viewport aspect ratio
 * @returns Aspect ratio as width/height rounded to 2 decimal places
 */
export const getAspectRatio = (): number => {
  const { width, height } = getViewportDimensions();
  return Number((width / height).toFixed(2));
};

/**
 * Example usage:
 * 
 * import { getViewportDimensions, isSmallScreen } from './responsive.utils';
 * 
 * const ResponsiveComponent = () => {
 *   const { width } = getViewportDimensions();
 *   
 *   return (
 *     <div className={isSmallScreen(width) ? 'small' : 'large'}>
 *       Responsive Content
 *     </div>
 *   );
 * };
 */