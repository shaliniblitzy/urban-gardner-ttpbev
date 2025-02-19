/**
 * @fileoverview Redux store types for plant state management
 * @version 1.0.0
 * 
 * Defines TypeScript types and interfaces for:
 * - Redux action types for plant operations
 * - Plant state shape in Redux store
 * - Action interfaces for plant CRUD operations
 */

import { Plant } from '../../types/plant.types';

/**
 * Enum of all possible Redux action types for plant management
 * Covers CRUD operations and async data fetching
 */
export enum PlantActionTypes {
    FETCH_PLANTS_REQUEST = 'FETCH_PLANTS_REQUEST',
    FETCH_PLANTS_SUCCESS = 'FETCH_PLANTS_SUCCESS',
    FETCH_PLANTS_FAILURE = 'FETCH_PLANTS_FAILURE',
    ADD_PLANT = 'ADD_PLANT',
    UPDATE_PLANT = 'UPDATE_PLANT',
    DELETE_PLANT = 'DELETE_PLANT',
    SELECT_PLANT = 'SELECT_PLANT'
}

/**
 * Interface defining the shape of plant state in Redux store
 * Manages plant data, selection state, loading states and errors
 */
export interface PlantState {
    /** Map of plant IDs to plant objects for efficient lookups */
    plants: Record<string, Plant>;
    /** Currently selected plant ID for detail view/editing */
    selectedPlantId: string | null;
    /** Loading state for async operations */
    loading: boolean;
    /** Error message from failed operations */
    error: string | null;
}

/**
 * Action interface for initiating plant data fetch
 */
export interface FetchPlantsRequestAction {
    type: PlantActionTypes.FETCH_PLANTS_REQUEST;
}

/**
 * Action interface for successful plant data fetch
 */
export interface FetchPlantsSuccessAction {
    type: PlantActionTypes.FETCH_PLANTS_SUCCESS;
    payload: Plant[];
}

/**
 * Action interface for failed plant data fetch
 */
export interface FetchPlantsFailureAction {
    type: PlantActionTypes.FETCH_PLANTS_FAILURE;
    payload: string;
}

/**
 * Action interface for adding a new plant
 */
export interface AddPlantAction {
    type: PlantActionTypes.ADD_PLANT;
    payload: Plant;
}

/**
 * Action interface for updating existing plant
 */
export interface UpdatePlantAction {
    type: PlantActionTypes.UPDATE_PLANT;
    payload: Plant;
}

/**
 * Action interface for deleting a plant
 */
export interface DeletePlantAction {
    type: PlantActionTypes.DELETE_PLANT;
    payload: string;
}

/**
 * Action interface for selecting a plant
 */
export interface SelectPlantAction {
    type: PlantActionTypes.SELECT_PLANT;
    payload: string;
}

/**
 * Union type of all possible plant actions
 * Used for type checking in reducers and action creators
 */
export type PlantAction =
    | FetchPlantsRequestAction
    | FetchPlantsSuccessAction
    | FetchPlantsFailureAction
    | AddPlantAction
    | UpdatePlantAction
    | DeletePlantAction
    | SelectPlantAction;