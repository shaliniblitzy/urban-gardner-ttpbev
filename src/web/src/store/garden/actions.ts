/**
 * @fileoverview Redux action creators for garden state management
 * @version 1.0.0
 * 
 * Implements action creators for:
 * - Garden creation and validation
 * - Garden fetching with caching
 * - Layout generation with optimization
 * - Error handling and request management
 */

import { ThunkAction } from 'redux-thunk'; // ^2.4.0
import { Dispatch } from 'redux'; // ^4.2.0
import { CancellationToken } from 'axios'; // ^1.6.0
import { GardenActionTypes } from './types';
import { Garden, GardenInput, GardenLayout, GardenOptimizationParams } from '../../types/garden.types';
import { gardenService } from '../../services/garden.service';
import { ApiError } from '../../services/api.service';

// Action type for garden state
type GardenThunkAction<R = void> = ThunkAction<
    Promise<R>,
    any,
    undefined,
    any
>;

/**
 * Creates a new garden with validation and error handling
 * @param gardenInput Garden creation parameters
 * @param cancelToken Optional cancellation token
 */
export const createGarden = (
    gardenInput: GardenInput,
    cancelToken?: CancellationToken
): GardenThunkAction<Garden> => {
    return async (dispatch: Dispatch) => {
        try {
            dispatch({ type: GardenActionTypes.CREATE_GARDEN_REQUEST });

            const garden = await gardenService.createGarden(gardenInput);

            dispatch({
                type: GardenActionTypes.CREATE_GARDEN_SUCCESS,
                payload: garden
            });

            return garden;
        } catch (error) {
            const apiError = error as ApiError;
            dispatch({
                type: GardenActionTypes.CREATE_GARDEN_FAILURE,
                payload: apiError.message
            });
            throw apiError;
        }
    };
};

/**
 * Fetches all gardens with caching and pagination support
 * @param cancelToken Optional cancellation token
 */
export const fetchGardens = (
    cancelToken?: CancellationToken
): GardenThunkAction<Garden[]> => {
    return async (dispatch: Dispatch) => {
        try {
            dispatch({ type: GardenActionTypes.FETCH_GARDENS_REQUEST });

            const gardens = await gardenService.getGardens();

            dispatch({
                type: GardenActionTypes.FETCH_GARDENS_SUCCESS,
                payload: gardens
            });

            return gardens;
        } catch (error) {
            const apiError = error as ApiError;
            dispatch({
                type: GardenActionTypes.FETCH_GARDENS_FAILURE,
                payload: apiError.message
            });
            throw apiError;
        }
    };
};

/**
 * Generates optimized garden layout with progress tracking
 * @param gardenId Garden identifier
 * @param params Optimization parameters
 * @param cancelToken Optional cancellation token
 */
export const generateLayout = (
    gardenId: string,
    params: GardenOptimizationParams,
    cancelToken?: CancellationToken
): GardenThunkAction<GardenLayout> => {
    return async (dispatch: Dispatch) => {
        try {
            dispatch({ 
                type: GardenActionTypes.GENERATE_LAYOUT_REQUEST,
                payload: { gardenId }
            });

            const layout = await gardenService.generateLayout(gardenId, params);

            dispatch({
                type: GardenActionTypes.GENERATE_LAYOUT_SUCCESS,
                payload: layout
            });

            return layout;
        } catch (error) {
            const apiError = error as ApiError;
            dispatch({
                type: GardenActionTypes.GENERATE_LAYOUT_FAILURE,
                payload: {
                    gardenId,
                    error: apiError.message
                }
            });
            throw apiError;
        }
    };
};

/**
 * Sets the current active garden with validation
 * @param garden Garden to set as current
 */
export const setCurrentGarden = (garden: Garden) => {
    // Validate garden object
    if (!garden.id || !garden.area || !garden.zones) {
        throw new Error('Invalid garden object provided');
    }

    return {
        type: GardenActionTypes.SET_CURRENT_GARDEN,
        payload: garden
    };
};