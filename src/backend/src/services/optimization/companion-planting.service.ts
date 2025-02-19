/**
 * Service responsible for optimizing plant placement based on companion planting principles
 * Implements efficient space utilization through companion relationships and spacing calculations
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { IPlant } from '../../interfaces/plant.interface';
import { COMPANION_PLANTS, PLANT_TYPES } from '../../constants/plant.constants';

@Injectable()
export class CompanionPlantingService {
    private readonly companionPlantsMap: Map<PLANT_TYPES, PLANT_TYPES[]>;
    private readonly spacingAdjustments: Map<string, number>;

    constructor() {
        // Initialize companion plants mapping
        this.companionPlantsMap = new Map(Object.entries(COMPANION_PLANTS));

        // Initialize spacing adjustments for companion pairs
        // Reduce spacing requirements by 25% for compatible companions
        this.spacingAdjustments = new Map<string, number>();
        Object.keys(COMPANION_PLANTS).forEach(plantType => {
            COMPANION_PLANTS[plantType as PLANT_TYPES].forEach(companion => {
                const pairKey = this.getCompanionPairKey(
                    plantType as PLANT_TYPES,
                    companion
                );
                this.spacingAdjustments.set(pairKey, 0.75); // 25% reduction
            });
        });
    }

    /**
     * Optimizes plant placement based on companion planting principles
     * @param existingPlants - Array of plants already in the garden
     * @param newPlant - Plant to be placed in the garden
     * @returns Observable<boolean> indicating if placement is optimal
     */
    public optimizePlantPlacement(
        existingPlants: IPlant[],
        newPlant: IPlant
    ): Observable<boolean> {
        return of(existingPlants).pipe(
            map(plants => {
                if (!plants || !newPlant) {
                    throw new Error('Invalid input parameters');
                }

                // Check compatibility with all existing plants
                const compatibilityResults = plants.map(plant =>
                    this.checkCompatibility(plant.type, newPlant.type)
                );

                // Calculate spacing efficiency
                const spacingEfficiency = plants.map(plant =>
                    this.calculateOptimalSpacing(plant, newPlant)
                );

                // Placement is optimal if at least one compatible neighbor
                // and spacing requirements are met
                return (
                    compatibilityResults.some(result => result) &&
                    spacingEfficiency.every(spacing => spacing > 0)
                );
            }),
            catchError(error => {
                console.error('Plant placement optimization error:', error);
                return of(false);
            })
        );
    }

    /**
     * Checks if two plants are compatible companions
     * @param plant1Type - Type of first plant
     * @param plant2Type - Type of second plant
     * @returns boolean indicating compatibility
     */
    public checkCompatibility(
        plant1Type: PLANT_TYPES,
        plant2Type: PLANT_TYPES
    ): boolean {
        try {
            if (!this.companionPlantsMap.has(plant1Type)) {
                return false;
            }

            const companions = this.companionPlantsMap.get(plant1Type);
            return companions?.includes(plant2Type) || false;
        } catch (error) {
            console.error('Companion compatibility check error:', error);
            return false;
        }
    }

    /**
     * Calculates optimal spacing between companion plants
     * @param plant1 - First plant
     * @param plant2 - Second plant
     * @returns number representing optimal spacing in inches
     */
    public calculateOptimalSpacing(plant1: IPlant, plant2: IPlant): number {
        try {
            // Get base spacing requirements
            const baseSpacing = Math.max(plant1.spacing, plant2.spacing);

            // Apply companion planting adjustment if plants are compatible
            const adjustmentFactor = this.getSpacingAdjustment(
                plant1.type,
                plant2.type
            );

            // Calculate final spacing with minimum threshold
            const adjustedSpacing = Math.max(
                baseSpacing * adjustmentFactor,
                Math.min(plant1.spacing, plant2.spacing) * 0.75 // Never go below 75% of smaller spacing
            );

            return Number(adjustedSpacing.toFixed(1));
        } catch (error) {
            console.error('Optimal spacing calculation error:', error);
            return -1;
        }
    }

    /**
     * Generates a unique key for companion plant pairs
     * @private
     */
    private getCompanionPairKey(
        plant1Type: PLANT_TYPES,
        plant2Type: PLANT_TYPES
    ): string {
        return [plant1Type, plant2Type].sort().join('_');
    }

    /**
     * Retrieves spacing adjustment factor for plant pairs
     * @private
     */
    private getSpacingAdjustment(
        plant1Type: PLANT_TYPES,
        plant2Type: PLANT_TYPES
    ): number {
        const pairKey = this.getCompanionPairKey(plant1Type, plant2Type);
        return this.spacingAdjustments.get(pairKey) || 1.0;
    }
}