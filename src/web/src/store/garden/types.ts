/**
 * @fileoverview Redux store types for garden state management
 * @version 1.0.0
 * 
 * Defines TypeScript types and interfaces for:
 * - Garden state structure
 * - Action types for garden operations
 * - Action interfaces for Redux
 */

import { Action } from 'redux'; // v4.2.0
import { Garden, GardenLayout } from '../../types/garden.types';

/**
 * Interface defining the structure of garden state in Redux store
 * Manages gardens, layouts, loading states and errors
 */
export interface GardenState {
    /** Array of all gardens */
    gardens: Garden[];
    /** Currently selected garden */
    currentGarden: Garden | null;
    /** Current optimized layout */
    currentLayout: GardenLayout | null;
    /** Loading state indicator */
    loading: boolean;
    /** Error message if any */
    error: string | null;
}

/**
 * Enum of all possible garden-related action types
 * Used for type-safe Redux actions
 */
export enum GardenActionTypes {
    CREATE_GARDEN_REQUEST = 'CREATE_GARDEN_REQUEST',
    CREATE_GARDEN_SUCCESS = 'CREATE_GARDEN_SUCCESS',
    CREATE_GARDEN_FAILURE = 'CREATE_GARDEN_FAILURE',
    
    FETCH_GARDENS_REQUEST = 'FETCH_GARDENS_REQUEST',
    FETCH_GARDENS_SUCCESS = 'FETCH_GARDENS_SUCCESS',
    FETCH_GARDENS_FAILURE = 'FETCH_GARDENS_FAILURE',
    
    GENERATE_LAYOUT_REQUEST = 'GENERATE_LAYOUT_REQUEST',
    GENERATE_LAYOUT_SUCCESS = 'GENERATE_LAYOUT_SUCCESS',
    GENERATE_LAYOUT_FAILURE = 'GENERATE_LAYOUT_FAILURE',
    
    SET_CURRENT_GARDEN = 'SET_CURRENT_GARDEN'
}

/**
 * Action interfaces for garden creation
 */
export interface CreateGardenRequestAction extends Action<GardenActionTypes.CREATE_GARDEN_REQUEST> {}

export interface CreateGardenSuccessAction extends Action<GardenActionTypes.CREATE_GARDEN_SUCCESS> {
    payload: Garden;
}

export interface CreateGardenFailureAction extends Action<GardenActionTypes.CREATE_GARDEN_FAILURE> {
    payload: string;
}

/**
 * Action interfaces for fetching gardens
 */
export interface FetchGardensRequestAction extends Action<GardenActionTypes.FETCH_GARDENS_REQUEST> {}

export interface FetchGardensSuccessAction extends Action<GardenActionTypes.FETCH_GARDENS_SUCCESS> {
    payload: Garden[];
}

export interface FetchGardensFailureAction extends Action<GardenActionTypes.FETCH_GARDENS_FAILURE> {
    payload: string;
}

/**
 * Action interfaces for layout generation
 */
export interface GenerateLayoutRequestAction extends Action<GardenActionTypes.GENERATE_LAYOUT_REQUEST> {}

export interface GenerateLayoutSuccessAction extends Action<GardenActionTypes.GENERATE_LAYOUT_SUCCESS> {
    payload: GardenLayout;
}

export interface GenerateLayoutFailureAction extends Action<GardenActionTypes.GENERATE_LAYOUT_FAILURE> {
    payload: string;
}

/**
 * Action interface for setting current garden
 */
export interface SetCurrentGardenAction extends Action<GardenActionTypes.SET_CURRENT_GARDEN> {
    payload: Garden;
}

/**
 * Union type of all possible garden actions
 * Used for type checking in reducers
 */
export type GardenAction =
    | CreateGardenRequestAction
    | CreateGardenSuccessAction
    | CreateGardenFailureAction
    | FetchGardensRequestAction
    | FetchGardensSuccessAction
    | FetchGardensFailureAction
    | GenerateLayoutRequestAction
    | GenerateLayoutSuccessAction
    | GenerateLayoutFailureAction
    | SetCurrentGardenAction;