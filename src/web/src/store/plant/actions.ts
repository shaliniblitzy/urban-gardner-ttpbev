import { Dispatch } from 'redux'; // ^4.2.0
import { ThunkAction } from 'redux-thunk'; // ^2.4.2
import { PlantActionTypes } from './types';
import { Plant } from '../../types/plant.types';
import { plantService } from '../../services/plant.service';

// Types for state and actions
type AppState = any; // Replace with your actual root state type
type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  AppState,
  unknown,
  PlantAction
>;
type PlantAction = {
  type: PlantActionTypes;
  payload?: any;
  error?: string;
};

/**
 * Action creator for initiating plants fetch request
 */
export const fetchPlantsRequest = (): PlantAction => ({
  type: PlantActionTypes.FETCH_PLANTS_REQUEST
});

/**
 * Action creator for successful plants fetch
 */
export const fetchPlantsSuccess = (plants: Plant[]): PlantAction => ({
  type: PlantActionTypes.FETCH_PLANTS_SUCCESS,
  payload: plants
});

/**
 * Action creator for failed plants fetch
 */
export const fetchPlantsFailure = (error: string): PlantAction => ({
  type: PlantActionTypes.FETCH_PLANTS_FAILURE,
  error
});

/**
 * Thunk action creator for fetching plants with pagination
 */
export const fetchPlants = (
  page: number = 1,
  limit: number = 10
): AppThunk => async (dispatch: Dispatch) => {
  dispatch(fetchPlantsRequest());
  
  try {
    const response = await plantService.getAllPlants({
      page,
      limit,
      sortBy: 'plantedDate',
      sortOrder: 'desc'
    });
    dispatch(fetchPlantsSuccess(response.items));
  } catch (error) {
    dispatch(fetchPlantsFailure(error instanceof Error ? error.message : 'Failed to fetch plants'));
  }
};

/**
 * Action creator for adding a new plant
 */
export const addPlant = (plant: Omit<Plant, 'id'>): AppThunk => async (dispatch: Dispatch) => {
  try {
    const newPlant = await plantService.createPlant(plant);
    dispatch({
      type: PlantActionTypes.ADD_PLANT,
      payload: newPlant
    });
  } catch (error) {
    dispatch(fetchPlantsFailure(error instanceof Error ? error.message : 'Failed to add plant'));
  }
};

/**
 * Action creator for updating an existing plant
 */
export const updatePlant = (id: string, plantData: Partial<Plant>): AppThunk => async (dispatch: Dispatch) => {
  try {
    const updatedPlant = await plantService.updatePlant(id, plantData);
    dispatch({
      type: PlantActionTypes.UPDATE_PLANT,
      payload: updatedPlant
    });
  } catch (error) {
    dispatch(fetchPlantsFailure(error instanceof Error ? error.message : 'Failed to update plant'));
  }
};

/**
 * Action creator for deleting a plant
 */
export const deletePlant = (id: string): AppThunk => async (dispatch: Dispatch) => {
  try {
    await plantService.deletePlant(id);
    dispatch({
      type: PlantActionTypes.DELETE_PLANT,
      payload: id
    });
  } catch (error) {
    dispatch(fetchPlantsFailure(error instanceof Error ? error.message : 'Failed to delete plant'));
  }
};

/**
 * Action creator for selecting a plant for detailed view
 */
export const selectPlant = (id: string): PlantAction => ({
  type: PlantActionTypes.SELECT_PLANT,
  payload: id
});

/**
 * Thunk action creator for batch updating multiple plants
 */
export const batchUpdatePlants = (
  updates: Array<{ id: string; data: Partial<Plant> }>
): AppThunk => async (dispatch: Dispatch) => {
  try {
    const updatedPlants = await plantService.batchUpdatePlants(updates);
    updatedPlants.forEach(plant => {
      dispatch({
        type: PlantActionTypes.UPDATE_PLANT,
        payload: plant
      });
    });
  } catch (error) {
    dispatch(fetchPlantsFailure(error instanceof Error ? error.message : 'Failed to batch update plants'));
  }
};

/**
 * Thunk action creator for updating plant growth stage
 */
export const updatePlantGrowthStage = (
  id: string,
  stage: Plant['growthStage']
): AppThunk => async (dispatch: Dispatch) => {
  try {
    const updatedPlant = await plantService.updatePlantGrowthStage(id, stage);
    dispatch({
      type: PlantActionTypes.UPDATE_PLANT,
      payload: updatedPlant
    });
  } catch (error) {
    dispatch(fetchPlantsFailure(error instanceof Error ? error.message : 'Failed to update plant growth stage'));
  }
};