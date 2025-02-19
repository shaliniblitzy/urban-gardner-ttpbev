/**
 * @fileoverview Redux selectors for garden state management with enhanced validation and memoization
 * @version 1.0.0
 */

import { createSelector } from 'reselect'; // v4.2.0
import { GardenState } from './types';
import { Garden } from '../../types/garden.types';
import { SunlightCondition } from '../../types/zone.types';

/**
 * Base selector to access the garden state slice
 * Provides type-safe access to garden state
 */
export const selectGardenState = (state: { garden: GardenState }): GardenState => state.garden;

/**
 * Validates garden area constraints and zone compatibility
 * @param garden Garden to validate
 * @returns boolean indicating if garden is valid
 */
const validateGarden = (garden: Garden): boolean => {
  // Validate area constraints (1-1000 sq ft)
  if (garden.area < 1 || garden.area > 1000) {
    return false;
  }

  // Validate zones
  if (!garden.zones || garden.zones.length === 0) {
    return false;
  }

  // Validate total zone area doesn't exceed garden area
  const totalZoneArea = garden.zones.reduce((sum, zone) => sum + zone.area, 0);
  if (totalZoneArea > garden.area) {
    return false;
  }

  // Validate each zone has valid sunlight condition
  return garden.zones.every(zone => 
    Object.values(SunlightCondition).includes(zone.sunlightCondition)
  );
};

/**
 * Memoized selector for retrieving all gardens with validation
 * Filters out invalid gardens based on area and zone constraints
 */
export const selectGardens = createSelector(
  [selectGardenState],
  (gardenState: GardenState): Garden[] => {
    return gardenState.gardens.filter(validateGarden);
  }
);

/**
 * Memoized selector for current garden with enhanced validation
 * Returns null if current garden is invalid or not selected
 */
export const selectCurrentGarden = createSelector(
  [selectGardenState],
  (gardenState: GardenState): Garden | null => {
    const { currentGarden } = gardenState;
    if (!currentGarden || !validateGarden(currentGarden)) {
      return null;
    }
    return currentGarden;
  }
);

/**
 * Memoized selector for current garden layout with space utilization metrics
 * Includes validation for zone assignments and plant spacing
 */
export const selectCurrentLayout = createSelector(
  [selectGardenState],
  (gardenState: GardenState) => {
    const { currentLayout } = gardenState;
    if (!currentLayout) {
      return null;
    }

    // Validate layout has zones
    if (!currentLayout.zones || currentLayout.zones.length === 0) {
      return null;
    }

    // Validate space utilization is within bounds
    if (currentLayout.spaceUtilization < 0 || currentLayout.spaceUtilization > 100) {
      return null;
    }

    return currentLayout;
  }
);

/**
 * Memoized selector for loading state
 * Used to track garden operations in progress
 */
export const selectGardenLoading = createSelector(
  [selectGardenState],
  (gardenState: GardenState): boolean => gardenState.loading
);

/**
 * Memoized selector for error state
 * Provides type-safe access to error messages
 */
export const selectGardenError = createSelector(
  [selectGardenState],
  (gardenState: GardenState): string | null => gardenState.error
);

/**
 * Memoized selector factory for finding garden by ID
 * Includes comprehensive validation of garden properties
 */
export const selectGardenById = (gardenId: string) => createSelector(
  [selectGardens],
  (gardens: Garden[]): Garden | undefined => {
    if (!gardenId) {
      return undefined;
    }
    const garden = gardens.find(g => g.id === gardenId);
    if (!garden || !validateGarden(garden)) {
      return undefined;
    }
    return garden;
  }
);

/**
 * Memoized selector for space utilization percentage
 * Calculates overall garden space efficiency
 */
export const selectSpaceUtilization = createSelector(
  [selectCurrentLayout],
  (layout) => {
    if (!layout) {
      return 0;
    }
    return layout.spaceUtilization;
  }
);

/**
 * Memoized selector for zone compatibility validation
 * Ensures plants are placed in zones with compatible sunlight conditions
 */
export const selectZoneCompatibility = createSelector(
  [selectCurrentGarden],
  (garden) => {
    if (!garden) {
      return false;
    }
    
    return garden.zones.every(zone => 
      zone.plants.every(plant => 
        plant.sunlightNeeds === zone.sunlightCondition
      )
    );
  }
);