/**
 * @fileoverview Redux reducer for plant state management with performance optimization
 * @version 1.0.0
 * 
 * Implements comprehensive plant state management including:
 * - Growth parameter tracking
 * - Maintenance history
 * - Health monitoring
 * - Space optimization support
 */

import { 
    PlantState, 
    PlantAction, 
    PlantActionTypes 
} from './types';

import {
    Plant,
    PlantHealth,
    GrowthStage,
    MaintenanceRecord,
    MaintenanceType
} from '../../types/plant.types';

// Performance threshold for state updates (ms)
const PERFORMANCE_THRESHOLD = 3000;

// Initial state with comprehensive tracking
const initialState: PlantState = {
    plants: {},
    selectedPlantId: null,
    loading: false,
    error: null,
    maintenanceHistory: {},
    healthStatus: {},
    lastUpdate: Date.now()
};

/**
 * Validates plant growth parameters against requirements
 * @param plant Plant data to validate
 * @returns boolean indicating validity
 */
const validatePlantParameters = (plant: Plant): boolean => {
    return (
        plant.spacing > 0 &&
        plant.daysToMaturity > 0 &&
        plant.expectedYield > 0 &&
        plant.sunlightNeeds !== undefined &&
        Array.isArray(plant.companionPlants)
    );
};

/**
 * Updates plant health status based on maintenance history
 * @param plant Plant to evaluate
 * @param history Maintenance history records
 * @returns Updated health status
 */
const evaluateHealthStatus = (plant: Plant, history: MaintenanceRecord[]): PlantHealth => {
    const now = new Date();
    const lastMaintenance = history[history.length - 1]?.date || plant.plantedDate;
    const daysSinceLastMaintenance = Math.floor((now.getTime() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastMaintenance <= 7) return PlantHealth.EXCELLENT;
    if (daysSinceLastMaintenance <= 14) return PlantHealth.GOOD;
    if (daysSinceLastMaintenance <= 21) return PlantHealth.FAIR;
    return PlantHealth.POOR;
};

/**
 * Redux reducer for plant state management
 * Handles all plant-related actions with performance optimization
 */
const plantReducer = (
    state: PlantState = initialState,
    action: PlantAction
): PlantState => {
    const startTime = Date.now();

    try {
        switch (action.type) {
            case PlantActionTypes.FETCH_PLANTS_REQUEST:
                return {
                    ...state,
                    loading: true,
                    error: null
                };

            case PlantActionTypes.FETCH_PLANTS_SUCCESS: {
                const plantsMap = action.payload.reduce((acc, plant) => {
                    if (validatePlantParameters(plant)) {
                        acc[plant.id] = plant;
                    }
                    return acc;
                }, {} as Record<string, Plant>);

                return {
                    ...state,
                    plants: plantsMap,
                    loading: false,
                    error: null,
                    lastUpdate: Date.now()
                };
            }

            case PlantActionTypes.FETCH_PLANTS_FAILURE:
                return {
                    ...state,
                    loading: false,
                    error: action.payload,
                    lastUpdate: Date.now()
                };

            case PlantActionTypes.ADD_PLANT: {
                const newPlant = action.payload;
                if (!validatePlantParameters(newPlant)) {
                    return {
                        ...state,
                        error: 'E001: Invalid plant parameters'
                    };
                }

                return {
                    ...state,
                    plants: {
                        ...state.plants,
                        [newPlant.id]: newPlant
                    },
                    maintenanceHistory: {
                        ...state.maintenanceHistory,
                        [newPlant.id]: []
                    },
                    healthStatus: {
                        ...state.healthStatus,
                        [newPlant.id]: PlantHealth.EXCELLENT
                    },
                    error: null,
                    lastUpdate: Date.now()
                };
            }

            case PlantActionTypes.UPDATE_PLANT: {
                const updatedPlant = action.payload;
                if (!state.plants[updatedPlant.id]) {
                    return {
                        ...state,
                        error: 'E002: Plant not found'
                    };
                }

                const updatedHealth = evaluateHealthStatus(
                    updatedPlant,
                    state.maintenanceHistory[updatedPlant.id] || []
                );

                return {
                    ...state,
                    plants: {
                        ...state.plants,
                        [updatedPlant.id]: updatedPlant
                    },
                    healthStatus: {
                        ...state.healthStatus,
                        [updatedPlant.id]: updatedHealth
                    },
                    error: null,
                    lastUpdate: Date.now()
                };
            }

            case PlantActionTypes.DELETE_PLANT: {
                const { [action.payload]: deletedPlant, ...remainingPlants } = state.plants;
                const { [action.payload]: deletedHistory, ...remainingHistory } = state.maintenanceHistory;
                const { [action.payload]: deletedHealth, ...remainingHealth } = state.healthStatus;

                return {
                    ...state,
                    plants: remainingPlants,
                    maintenanceHistory: remainingHistory,
                    healthStatus: remainingHealth,
                    selectedPlantId: state.selectedPlantId === action.payload ? null : state.selectedPlantId,
                    error: null,
                    lastUpdate: Date.now()
                };
            }

            case PlantActionTypes.SELECT_PLANT:
                return {
                    ...state,
                    selectedPlantId: action.payload,
                    error: null,
                    lastUpdate: Date.now()
                };

            case PlantActionTypes.UPDATE_HEALTH_STATUS: {
                const { plantId, health } = action.payload;
                if (!state.plants[plantId]) {
                    return {
                        ...state,
                        error: 'E003: Plant not found for health update'
                    };
                }

                return {
                    ...state,
                    healthStatus: {
                        ...state.healthStatus,
                        [plantId]: health
                    },
                    error: null,
                    lastUpdate: Date.now()
                };
            }

            case PlantActionTypes.ADD_MAINTENANCE_RECORD: {
                const { plantId, record } = action.payload;
                if (!state.plants[plantId]) {
                    return {
                        ...state,
                        error: 'E004: Plant not found for maintenance record'
                    };
                }

                const updatedHistory = [
                    ...(state.maintenanceHistory[plantId] || []),
                    record
                ];

                const updatedHealth = evaluateHealthStatus(
                    state.plants[plantId],
                    updatedHistory
                );

                return {
                    ...state,
                    maintenanceHistory: {
                        ...state.maintenanceHistory,
                        [plantId]: updatedHistory
                    },
                    healthStatus: {
                        ...state.healthStatus,
                        [plantId]: updatedHealth
                    },
                    error: null,
                    lastUpdate: Date.now()
                };
            }

            case PlantActionTypes.UPDATE_GROWTH_STAGE: {
                const { plantId, stage } = action.payload;
                if (!state.plants[plantId]) {
                    return {
                        ...state,
                        error: 'E005: Plant not found for growth stage update'
                    };
                }

                return {
                    ...state,
                    plants: {
                        ...state.plants,
                        [plantId]: {
                            ...state.plants[plantId],
                            growthStage: stage
                        }
                    },
                    error: null,
                    lastUpdate: Date.now()
                };
            }

            default:
                return state;
        }
    } finally {
        // Performance monitoring
        const duration = Date.now() - startTime;
        if (duration > PERFORMANCE_THRESHOLD) {
            console.warn(`Plant reducer update exceeded performance threshold: ${duration}ms`);
        }
    }
};

export default plantReducer;