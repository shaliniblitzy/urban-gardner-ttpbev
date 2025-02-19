/**
 * @fileoverview Redux selectors for plant state management with memoization
 * @version 1.0.0
 * 
 * Implements optimized selectors for:
 * - Plant data access and filtering
 * - Growth stage tracking
 * - Maintenance scheduling
 * - Health status monitoring
 */

import { createSelector } from '@reduxjs/toolkit'; // ^1.9.0
import { RootState } from '../index';
import { PlantState } from './types';
import { Plant, GrowthStage, PlantHealth } from '../../types/plant.types';

/**
 * Base selector for accessing plant state slice
 * Provides type-safe access to plant state
 */
export const selectPlantState = (state: RootState): PlantState => state.plant;

/**
 * Memoized selector for loading state
 * Used to track async operations
 */
export const selectPlantsLoading = createSelector(
    [selectPlantState],
    (plantState): boolean => plantState.loading
);

/**
 * Memoized selector for error state
 * Provides type-safe error message access
 */
export const selectPlantsError = createSelector(
    [selectPlantState],
    (plantState): string | null => plantState.error
);

/**
 * Memoized selector for all plants
 * Converts plants record to sorted array with consistent ordering
 */
export const selectAllPlants = createSelector(
    [selectPlantState],
    (plantState): Plant[] => {
        return Object.values(plantState.plants).sort((a, b) => 
            a.plantedDate.getTime() - b.plantedDate.getTime()
        );
    }
);

/**
 * Memoized selector factory for finding plant by ID
 * Provides efficient single plant lookup
 */
export const selectPlantById = createSelector(
    [
        selectPlantState,
        (state: RootState, plantId: string) => plantId
    ],
    (plantState, plantId): Plant | undefined => plantState.plants[plantId]
);

/**
 * Memoized selector for currently selected plant
 * Returns null if no plant is selected
 */
export const selectSelectedPlant = createSelector(
    [selectPlantState],
    (plantState): Plant | null => {
        return plantState.selectedPlantId 
            ? plantState.plants[plantState.selectedPlantId] 
            : null;
    }
);

/**
 * Memoized selector for filtering plants by growth stage
 * Optimized for frequent updates during plant lifecycle
 */
export const selectPlantsByGrowthStage = createSelector(
    [
        selectAllPlants,
        (state: RootState, stage: GrowthStage) => stage
    ],
    (plants, stage): Plant[] => {
        return plants.filter(plant => plant.growthStage === stage);
    }
);

/**
 * Memoized selector for plant health status
 * Provides efficient health monitoring for maintenance scheduling
 */
export const selectPlantHealthStatus = createSelector(
    [
        selectPlantState,
        (state: RootState, plantId: string) => plantId
    ],
    (plantState, plantId): PlantHealth | undefined => {
        return plantState.healthStatus[plantId];
    }
);

/**
 * Memoized selector for plant maintenance history
 * Optimized for tracking care activities
 */
export const selectPlantMaintenanceHistory = createSelector(
    [
        selectPlantState,
        (state: RootState, plantId: string) => plantId
    ],
    (plantState, plantId) => plantState.maintenanceHistory[plantId] || []
);

/**
 * Memoized selector for plants requiring maintenance
 * Filters plants based on health status and last maintenance date
 */
export const selectPlantsNeedingMaintenance = createSelector(
    [selectAllPlants, selectPlantState],
    (plants, plantState): Plant[] => {
        const now = new Date();
        return plants.filter(plant => {
            const health = plantState.healthStatus[plant.id];
            const history = plantState.maintenanceHistory[plant.id] || [];
            const lastMaintenance = history[history.length - 1]?.date || plant.plantedDate;
            const daysSinceLastMaintenance = Math.floor(
                (now.getTime() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24)
            );
            return health === PlantHealth.FAIR || health === PlantHealth.POOR || daysSinceLastMaintenance > 14;
        });
    }
);

/**
 * Memoized selector for companion planting suggestions
 * Returns compatible plants for a given plant ID
 */
export const selectCompatibleCompanionPlants = createSelector(
    [
        selectAllPlants,
        (state: RootState, plantId: string) => plantId
    ],
    (plants, plantId): Plant[] => {
        const targetPlant = plants.find(p => p.id === plantId);
        if (!targetPlant) return [];
        
        return plants.filter(plant => 
            plant.id !== plantId && 
            targetPlant.companionPlants.includes(plant.type)
        );
    }
);

/**
 * Memoized selector for space optimization
 * Returns plants with their spacing requirements
 */
export const selectPlantsWithSpacing = createSelector(
    [selectAllPlants],
    (plants): Array<{ plant: Plant; requiredSpace: number }> => {
        return plants.map(plant => ({
            plant,
            requiredSpace: plant.spacing
        }));
    }
);