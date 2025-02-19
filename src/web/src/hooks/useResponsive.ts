import { useState, useEffect } from 'react';
import { breakpoints } from '../theme/breakpoints';
import { getViewportDimensions } from '../utils/responsive.utils';

/**
 * Interface defining the structure of responsive design state
 * @version 1.0.0
 */
interface ResponsiveState {
  /** Indicates if viewport width is less than 375px */
  isSmall: boolean;
  /** Indicates if viewport width is between 376px and 768px */
  isMedium: boolean;
  /** Indicates if viewport width is greater than 768px */
  isLarge: boolean;
  /** Current viewport width in pixels */
  width: number;
  /** Current viewport height in pixels */
  height: number;
}

/**
 * Custom hook that provides responsive design utilities and screen size detection
 * with optimized resize handling and state management
 * @returns ResponsiveState object containing current screen size states and viewport dimensions
 */
export const useResponsive = (): ResponsiveState => {
  // Initialize viewport dimensions state
  const [dimensions, setDimensions] = useState(getViewportDimensions());
  
  // Initialize screen size states
  const [screenState, setScreenState] = useState<ResponsiveState>({
    isSmall: false,
    isMedium: false,
    isLarge: false,
    width: dimensions.width,
    height: dimensions.height,
  });

  /**
   * Updates screen size states based on current viewport width
   * @param width - Current viewport width
   */
  const updateScreenSizeState = (width: number): void => {
    setScreenState({
      isSmall: width < breakpoints.small,
      isMedium: width >= breakpoints.small && width < breakpoints.medium,
      isLarge: width >= breakpoints.large,
      width,
      height: dimensions.height,
    });
  };

  useEffect(() => {
    // Skip effect during SSR
    if (typeof window === 'undefined') return;

    let frameId: number;
    let resizeTimeout: NodeJS.Timeout;

    /**
     * Debounced resize handler using requestAnimationFrame for performance
     */
    const handleResize = () => {
      // Clear existing frame if any
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      // Clear existing timeout if any
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      // Schedule new frame
      frameId = requestAnimationFrame(() => {
        const newDimensions = getViewportDimensions();
        setDimensions(newDimensions);
        updateScreenSizeState(newDimensions.width);
      });

      // Set a timeout to ensure final update after resize ends
      resizeTimeout = setTimeout(() => {
        const finalDimensions = getViewportDimensions();
        setDimensions(finalDimensions);
        updateScreenSizeState(finalDimensions.width);
      }, 250);
    };

    // Set initial screen size state
    updateScreenSizeState(dimensions.width);

    // Add resize event listener
    window.addEventListener('resize', handleResize, { passive: true });

    // Handle orientation change for mobile devices
    window.addEventListener('orientationchange', handleResize, { passive: true });

    // Cleanup function
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [dimensions.width, dimensions.height]);

  return screenState;
};

/**
 * Example usage:
 * 
 * import { useResponsive } from '../hooks/useResponsive';
 * 
 * const ResponsiveComponent = () => {
 *   const { isSmall, isMedium, isLarge, width, height } = useResponsive();
 *   
 *   return (
 *     <div>
 *       {isSmall && <MobileLayout />}
 *       {isMedium && <TabletLayout />}
 *       {isLarge && <DesktopLayout />}
 *     </div>
 *   );
 * };
 */