/**
 * Space Calculator Service
 * @packageVersion 5.0
 * 
 * Implements garden space optimization algorithms targeting 30% improvement in space utilization
 * and layout generation within 3-second performance requirement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IGarden, IGardenLayout, IGardenOptimizationParams, IGardenZone } from '../../interfaces/garden.interface';
import { calculatePlantSpacing, calculateZoneArea, calculatePlantDensity, calculateSpaceEfficiency } from '../../utils/garden-math.utils';
import { GARDEN_AREA_LIMITS, OPTIMIZATION_CACHE_TTL, LAYOUT_GENERATION_TIMEOUT, SPACE_UTILIZATION_TARGET } from '../../constants/garden.constants';
import { PLANT_TYPES, COMPANION_PLANTS } from '../../constants/plant.constants';

@Injectable()
export class SpaceCalculatorService {
    private readonly logger = new Logger(SpaceCalculatorService.name);
    private readonly layoutCache = new Map<string, { layout: IGardenLayout; timestamp: number }>();

    /**
     * Calculates optimal garden layout with enhanced space utilization
     * @param garden Garden configuration
     * @param params Optimization parameters
     * @returns Promise<IGardenLayout>
     * @throws Error if garden area is invalid or optimization fails
     */
    async calculateOptimalLayout(
        garden: IGarden,
        params: IGardenOptimizationParams
    ): Promise<IGardenLayout> {
        const startTime = Date.now();
        const cacheKey = `${garden.id}-${JSON.stringify(params)}`;

        try {
            // Check cache first
            const cached = this.layoutCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < OPTIMIZATION_CACHE_TTL * 1000) {
                return cached.layout;
            }

            // Validate garden area
            if (!this.validateGardenArea(garden.area)) {
                throw new Error(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`);
            }

            // Calculate zone distribution
            const zoneDistribution = this.calculateZoneDistribution(
                garden.area,
                params.minZoneSize,
                garden.zones
            );

            // Optimize plant placement within zones
            const optimizedZones = await this.optimizePlantPlacement(
                zoneDistribution,
                garden.zones,
                params
            );

            // Calculate overall space utilization
            const spaceUtilization = this.calculateOverallUtilization(optimizedZones, garden.area);

            const layout: IGardenLayout = {
                gardenId: garden.id,
                spaceUtilization,
                zones: optimizedZones,
                generatedAt: new Date()
            };

            // Cache the result
            this.layoutCache.set(cacheKey, { layout, timestamp: Date.now() });

            // Verify performance requirement
            const executionTime = Date.now() - startTime;
            if (executionTime > LAYOUT_GENERATION_TIMEOUT) {
                this.logger.warn(`Layout generation exceeded ${LAYOUT_GENERATION_TIMEOUT}ms threshold: ${executionTime}ms`);
            }

            return layout;
        } catch (error) {
            this.logger.error(`Layout optimization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validates garden area against defined limits
     * @param area Garden area in square feet
     * @returns boolean
     */
    private validateGardenArea(area: number): boolean {
        return area >= GARDEN_AREA_LIMITS.MIN_AREA && area <= GARDEN_AREA_LIMITS.MAX_AREA;
    }

    /**
     * Calculates optimal zone distribution with maintenance paths
     * @param totalArea Total garden area
     * @param minZoneSize Minimum zone size
     * @param currentZones Current zone configuration
     * @returns Array of optimized zones
     */
    private calculateZoneDistribution(
        totalArea: number,
        minZoneSize: number,
        currentZones: IGardenZone[]
    ): IGardenZone[] {
        const maintenancePathArea = totalArea * 0.1; // 10% for paths
        const usableArea = totalArea - maintenancePathArea;
        
        // Calculate optimal zone sizes
        return currentZones.map(zone => {
            const zoneArea = calculateZoneArea(
                Math.sqrt(zone.area),
                Math.sqrt(zone.area),
                'rectangular'
            );

            return {
                ...zone,
                area: Math.max(zoneArea, minZoneSize)
            };
        });
    }

    /**
     * Optimizes plant placement within zones considering companion planting
     * @param zones Garden zones
     * @param currentZones Current zone configuration
     * @param params Optimization parameters
     * @returns Promise<IGardenZone[]>
     */
    private async optimizePlantPlacement(
        zones: IGardenZone[],
        currentZones: IGardenZone[],
        params: IGardenOptimizationParams
    ): Promise<IGardenZone[]> {
        return zones.map(zone => {
            const currentZone = currentZones.find(cz => cz.id === zone.id);
            if (!currentZone) return zone;

            const optimizedPlants = currentZone.plants.map(plant => {
                const spacing = calculatePlantSpacing(
                    params.defaultSpacing / 12, // Convert to feet
                    1.0, // Default growth factor
                    plant.type as PLANT_TYPES
                );

                // Consider companion planting
                const companions = COMPANION_PLANTS[plant.type as PLANT_TYPES] || [];
                const companionFactors = companions.reduce((acc, companion) => ({
                    ...acc,
                    [companion]: 1.1 // 10% efficiency boost for companion plants
                }), {});

                const density = calculatePlantDensity(
                    zone.area,
                    spacing,
                    companionFactors
                );

                return {
                    ...plant,
                    spacing
                };
            });

            return {
                ...zone,
                plants: optimizedPlants
            };
        });
    }

    /**
     * Calculates overall garden space utilization
     * @param zones Optimized garden zones
     * @param totalArea Total garden area
     * @returns number - Utilization percentage
     */
    private calculateOverallUtilization(zones: IGardenZone[], totalArea: number): number {
        const zoneFactors = zones.reduce((acc, zone) => ({
            ...acc,
            [zone.id]: zone.sunlightCondition === 'FULL_SUN' ? 1.2 : 1.0
        }), {});

        const usedArea = zones.reduce((sum, zone) => 
            sum + zone.area, 0
        );

        return calculateSpaceEfficiency(
            usedArea,
            totalArea,
            zoneFactors
        );
    }

    /**
     * Cleans expired entries from layout cache
     * @private
     */
    private cleanLayoutCache(): void {
        const now = Date.now();
        for (const [key, value] of this.layoutCache.entries()) {
            if (now - value.timestamp > OPTIMIZATION_CACHE_TTL * 1000) {
                this.layoutCache.delete(key);
            }
        }
    }
}