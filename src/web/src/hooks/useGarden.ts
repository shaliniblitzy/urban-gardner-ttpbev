import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { gardenService } from '../services/garden.service';
import { Garden, GardenInput, GardenLayout, GardenError } from '../types/garden.types';
import { GardenState, GardenAction, GardenActionTypes } from '../store/garden/reducer';

// Constants for performance monitoring and error handling
const PERFORMANCE_THRESHOLDS = {
  LAYOUT_GENERATION: 3000, // 3 seconds max for layout generation
  GARDEN_CREATION: 2000,   // 2 seconds max for garden creation
  MAX_RETRIES: 3,          // Maximum retry attempts
  RETRY_DELAY: 1000        // Base retry delay in milliseconds
};

/**
 * Custom hook for managing garden operations with enhanced error handling
 * and performance optimization
 */
export const useGarden = () => {
  const dispatch = useDispatch();
  const performanceRef = useRef<{ startTime: number }>({ startTime: 0 });
  const retryCountRef = useRef<number>(0);

  // Select garden state from Redux store
  const {
    gardens,
    currentGarden,
    currentLayout,
    loading,
    error
  } = useSelector((state: { garden: GardenState }) => state.garden);

  // Local error state for enhanced error handling
  const [localError, setLocalError] = useState<GardenError | null>(null);

  /**
   * Validates garden input against technical specifications
   */
  const validateGardenInput = useCallback((input: GardenInput): boolean => {
    try {
      if (!input.area || input.area < 1 || input.area > 1000) {
        throw new Error('Garden area must be between 1 and 1000 square feet');
      }
      if (!input.zones || input.zones.length === 0) {
        throw new Error('Garden must have at least one zone');
      }
      return true;
    } catch (error) {
      setLocalError({
        code: 'VALIDATION_ERROR',
        message: (error as Error).message,
        timestamp: Date.now(),
        retryable: false
      });
      return false;
    }
  }, []);

  /**
   * Creates a new garden with performance monitoring and retry mechanism
   */
  const createGarden = useCallback(async (gardenInput: GardenInput) => {
    if (!validateGardenInput(gardenInput)) {
      return;
    }

    performanceRef.current.startTime = Date.now();
    dispatch({ type: GardenActionTypes.CREATE_GARDEN_REQUEST });

    try {
      const garden = await gardenService.createGarden(gardenInput);
      
      // Check performance threshold
      const duration = Date.now() - performanceRef.current.startTime;
      if (duration > PERFORMANCE_THRESHOLDS.GARDEN_CREATION) {
        console.warn(`Garden creation exceeded performance threshold: ${duration}ms`);
      }

      dispatch({
        type: GardenActionTypes.CREATE_GARDEN_SUCCESS,
        payload: garden
      });

      return garden;
    } catch (error) {
      const shouldRetry = retryCountRef.current < PERFORMANCE_THRESHOLDS.MAX_RETRIES;
      
      dispatch({
        type: GardenActionTypes.CREATE_GARDEN_FAILURE,
        payload: (error as Error).message
      });

      if (shouldRetry) {
        retryCountRef.current++;
        setTimeout(() => createGarden(gardenInput), 
          PERFORMANCE_THRESHOLDS.RETRY_DELAY * retryCountRef.current);
      }
    }
  }, [dispatch, validateGardenInput]);

  /**
   * Generates optimized garden layout with performance monitoring
   */
  const generateLayout = useCallback(async (gardenId: string) => {
    if (!currentGarden) {
      setLocalError({
        code: 'NO_GARDEN_SELECTED',
        message: 'No garden selected for layout generation',
        timestamp: Date.now(),
        retryable: false
      });
      return;
    }

    performanceRef.current.startTime = Date.now();
    dispatch({ type: GardenActionTypes.GENERATE_LAYOUT_REQUEST });

    try {
      const layout = await gardenService.generateLayout(gardenId, {
        targetUtilization: 90,
        minZoneSize: 1,
        defaultSpacing: 0.5
      });

      // Check performance threshold
      const duration = Date.now() - performanceRef.current.startTime;
      if (duration > PERFORMANCE_THRESHOLDS.LAYOUT_GENERATION) {
        console.warn(`Layout generation exceeded performance threshold: ${duration}ms`);
      }

      dispatch({
        type: GardenActionTypes.GENERATE_LAYOUT_SUCCESS,
        payload: layout
      });

      return layout;
    } catch (error) {
      dispatch({
        type: GardenActionTypes.GENERATE_LAYOUT_FAILURE,
        payload: (error as Error).message
      });
    }
  }, [currentGarden, dispatch]);

  /**
   * Updates existing garden with optimistic updates
   */
  const updateGarden = useCallback(async (
    gardenId: string,
    updates: Partial<GardenInput>
  ) => {
    if (!validateGardenInput(updates as GardenInput)) {
      return;
    }

    // Optimistic update
    const optimisticGarden = { ...currentGarden, ...updates };
    dispatch({
      type: GardenActionTypes.SET_CURRENT_GARDEN,
      payload: optimisticGarden
    });

    try {
      const updatedGarden = await gardenService.updateGarden(gardenId, updates);
      dispatch({
        type: GardenActionTypes.SET_CURRENT_GARDEN,
        payload: updatedGarden
      });
      return updatedGarden;
    } catch (error) {
      // Revert optimistic update
      dispatch({
        type: GardenActionTypes.SET_CURRENT_GARDEN,
        payload: currentGarden
      });
      setLocalError({
        code: 'UPDATE_ERROR',
        message: (error as Error).message,
        timestamp: Date.now(),
        retryable: true
      });
    }
  }, [currentGarden, dispatch, validateGardenInput]);

  /**
   * Retries failed operations with exponential backoff
   */
  const retryOperation = useCallback(async (
    operation: () => Promise<void>,
    maxRetries: number = PERFORMANCE_THRESHOLDS.MAX_RETRIES
  ) => {
    if (retryCountRef.current >= maxRetries) {
      setLocalError({
        code: 'MAX_RETRIES_EXCEEDED',
        message: 'Maximum retry attempts exceeded',
        timestamp: Date.now(),
        retryable: false
      });
      return;
    }

    const delay = PERFORMANCE_THRESHOLDS.RETRY_DELAY * Math.pow(2, retryCountRef.current);
    retryCountRef.current++;
    
    setTimeout(operation, delay);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      retryCountRef.current = 0;
      performanceRef.current.startTime = 0;
    };
  }, []);

  return {
    // State
    gardens,
    currentGarden,
    currentLayout,
    loading,
    error: error || localError,
    
    // Actions
    createGarden,
    generateLayout,
    updateGarden,
    retryOperation,
    
    // Utilities
    validateGardenInput
  };
};

export default useGarden;