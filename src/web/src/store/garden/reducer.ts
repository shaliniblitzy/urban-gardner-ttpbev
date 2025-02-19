/**
 * @fileoverview Redux reducer for garden state management with enhanced error handling and performance optimizations
 * @version 1.0.0
 */

import { Reducer } from 'redux'; // v4.2.0
import {
  GardenState,
  GardenActionTypes,
  GardenAction
} from './types';
import { Garden, GardenLayout } from '../../types/garden.types';

// Constants for validation and error handling
const MAX_RETRY_ATTEMPTS = 3;
const GARDEN_AREA_LIMITS = {
  min: 1,
  max: 1000
};

// Error types for enhanced error handling
interface GardenError {
  code: string;
  message: string;
  timestamp: number;
  retryable: boolean;
}

// Initial state with enhanced error tracking
const initialState: GardenState = {
  gardens: [],
  currentGarden: null,
  currentLayout: null,
  loading: false,
  error: null,
  retryCount: 0
};

/**
 * Validates garden area input against defined limits
 * @param area Garden area in square feet
 * @returns boolean indicating if area is valid
 */
const isValidGardenArea = (area: number): boolean => {
  return area >= GARDEN_AREA_LIMITS.min && area <= GARDEN_AREA_LIMITS.max;
};

/**
 * Redux reducer for garden state management
 * Implements comprehensive error handling and performance optimizations
 */
export const gardenReducer: Reducer<GardenState, GardenAction> = (
  state = initialState,
  action
): GardenState => {
  switch (action.type) {
    case GardenActionTypes.CREATE_GARDEN_REQUEST:
      // Validate garden area before processing
      if (action.payload && !isValidGardenArea((action.payload as Garden).area)) {
        return {
          ...state,
          error: {
            code: 'E001',
            message: `Garden area must be between ${GARDEN_AREA_LIMITS.min} and ${GARDEN_AREA_LIMITS.max} sq ft`,
            timestamp: Date.now(),
            retryable: false
          },
          loading: false
        };
      }
      return {
        ...state,
        loading: true,
        error: null
      };

    case GardenActionTypes.CREATE_GARDEN_SUCCESS:
      return {
        ...state,
        gardens: [...state.gardens, action.payload as Garden],
        currentGarden: action.payload as Garden,
        loading: false,
        error: null,
        retryCount: 0
      };

    case GardenActionTypes.CREATE_GARDEN_FAILURE:
      const newRetryCount = state.retryCount + 1;
      const canRetry = newRetryCount < MAX_RETRY_ATTEMPTS;
      
      return {
        ...state,
        loading: false,
        error: {
          code: 'E002',
          message: action.payload as string,
          timestamp: Date.now(),
          retryable: canRetry
        },
        retryCount: newRetryCount
      };

    case GardenActionTypes.FETCH_GARDENS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };

    case GardenActionTypes.FETCH_GARDENS_SUCCESS:
      return {
        ...state,
        gardens: action.payload as Garden[],
        loading: false,
        error: null
      };

    case GardenActionTypes.FETCH_GARDENS_FAILURE:
      return {
        ...state,
        loading: false,
        error: {
          code: 'E003',
          message: action.payload as string,
          timestamp: Date.now(),
          retryable: true
        }
      };

    case GardenActionTypes.GENERATE_LAYOUT_REQUEST:
      if (!state.currentGarden) {
        return {
          ...state,
          error: {
            code: 'E004',
            message: 'No garden selected for layout generation',
            timestamp: Date.now(),
            retryable: false
          },
          loading: false
        };
      }
      return {
        ...state,
        loading: true,
        error: null
      };

    case GardenActionTypes.GENERATE_LAYOUT_SUCCESS:
      return {
        ...state,
        currentLayout: action.payload as GardenLayout,
        loading: false,
        error: null
      };

    case GardenActionTypes.GENERATE_LAYOUT_FAILURE:
      return {
        ...state,
        loading: false,
        error: {
          code: 'E005',
          message: action.payload as string,
          timestamp: Date.now(),
          retryable: true
        },
        currentLayout: null
      };

    case GardenActionTypes.SET_CURRENT_GARDEN:
      return {
        ...state,
        currentGarden: action.payload as Garden,
        currentLayout: null, // Reset layout when changing gardens
        error: null
      };

    case GardenActionTypes.VALIDATE_GARDEN_INPUT:
      const garden = action.payload as Garden;
      if (!garden || !isValidGardenArea(garden.area)) {
        return {
          ...state,
          error: {
            code: 'E001',
            message: `Invalid garden configuration. Area must be between ${GARDEN_AREA_LIMITS.min} and ${GARDEN_AREA_LIMITS.max} sq ft`,
            timestamp: Date.now(),
            retryable: false
          }
        };
      }
      return {
        ...state,
        error: null
      };

    case GardenActionTypes.CLEAR_ERROR_STATE:
      return {
        ...state,
        error: null,
        retryCount: 0
      };

    default:
      return state;
  }
};

export default gardenReducer;