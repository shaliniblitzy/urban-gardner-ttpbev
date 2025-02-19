/**
 * Garden Optimizer Service
 * @packageVersion 5.0
 * 
 * Core service responsible for garden layout optimization combining space utilization,
 * companion planting, and sunlight distribution algorithms. Implements caching and
 * performance monitoring to meet the 3-second response requirement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Observable, from, mergeMap } from 'rxjs';
import { MMKV } from 'react-native-mmkv';

import { IGarden, IGardenLayout } from '../../interfaces/garden.interface';
import { SpaceCalculatorService } from './space-calculator.service';
import { CompanionPlantingService } from './companion-planting.service';
import { SunlightAnalyzerService } from './sunlight-analyzer.service';

import {
    GARDEN_AREA_LIMITS,
    SPACE_UTILIZATION_TARGET,
    OPTIMIZATION_CACHE_TTL,
    LAYOUT_GENERATION_TIMEOUT
} from '../../constants/garden.constants';

@Injectable()
export class GardenOptimizerService {
    private readonly logger = new Logger(GardenOptimizerService.name);
    private readonly cache: MMKV;
    private readonly performanceMetrics: Map<string, number> = new Map();

    constructor(
        private readonly spaceCalculator: SpaceCalculatorService,
        private readonly companionPlanting: CompanionPlantingService,
        private readonly sunlightAnalyzer: SunlightAnalyzerService
    ) {
        this.cache = new MMKV();
        this.logger.log('Initializing GardenOptimizerService');
    }

    /**
     * Generates an optimized garden layout with enhanced caching and performance monitoring
     * @param garden Garden configuration to optimize
     * @returns Promise<IGardenLayout> Optimized garden layout
     */
    async optimizeGardenLayout(garden: IGarden): Promise<IGardenLayout> {
        const startTime = Date.now();
        const cacheKey = `layout_${garden.id}`;

        try {
            // Check cache first
            const cachedLayout = this.getCachedLayout(cacheKey);
            if (cachedLayout) {
                this.logger.debug('Returning cached layout');
                return cachedLayout;
            }

            // Validate garden configuration
            this.validateGardenInput(garden);

            // Analyze sunlight distribution
            const sunlightAnalysis = await this.sunlightAnalyzer.analyzeSunlightDistribution(garden);
            if (!sunlightAnalysis.isValid) {
                throw new Error(`Invalid sunlight distribution: ${sunlightAnalysis.recommendations?.join(', ')}`);
            }

            // Calculate optimal space utilization
            const optimizedLayout = await this.spaceCalculator.calculateOptimalLayout(garden, {
                targetUtilization: SPACE_UTILIZATION_TARGET,
                minZoneSize: 4,
                defaultSpacing: 12,
                maxZoneCount: garden.zones.length,
                companionPlantingEnabled: true,
                zoneBalancing: 'optimal',
                seasonalAdjustments: false
            });

            // Optimize plant placement with companion planting
            const optimizedZones = await this.optimizePlantPlacement(optimizedLayout);

            const finalLayout: IGardenLayout = {
                ...optimizedLayout,
                zones: optimizedZones,
                spaceUtilization: this.calculateFinalUtilization(optimizedZones, garden.area),
                generatedAt: new Date()
            };

            // Cache the result
            this.cacheLayout(cacheKey, finalLayout);

            // Track performance
            const executionTime = Date.now() - startTime;
            this.trackPerformance('layoutGeneration', executionTime);

            if (executionTime > LAYOUT_GENERATION_TIMEOUT) {
                this.logger.warn(`Layout generation exceeded ${LAYOUT_GENERATION_TIMEOUT}ms threshold: ${executionTime}ms`);
            }

            return finalLayout;
        } catch (error) {
            this.logger.error(`Garden optimization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validates garden input parameters
     * @param garden Garden configuration to validate
     * @throws Error if validation fails
     */
    private validateGardenInput(garden: IGarden): void {
        if (!garden.area || garden.area < GARDEN_AREA_LIMITS.MIN_AREA || garden.area > GARDEN_AREA_LIMITS.MAX_AREA) {
            throw new Error(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`);
        }

        if (!garden.zones || garden.zones.length === 0) {
            throw new Error('Garden must have at least one zone defined');
        }

        const totalZoneArea = garden.zones.reduce((sum, zone) => sum + zone.area, 0);
        if (Math.abs(totalZoneArea - garden.area) > 0.1) { // 0.1 sq ft tolerance
            throw new Error('Total zone area must match garden area');
        }
    }

    /**
     * Optimizes plant placement using companion planting rules
     * @param layout Initial optimized layout
     * @returns Promise<IGardenZone[]> Zones with optimized plant placement
     */
    private async optimizePlantPlacement(layout: IGardenLayout): Promise<IGardenZone[]> {
        return Promise.all(layout.zones.map(async zone => {
            const plantPlacements = new Map<string, boolean>();

            // Process plants in order of sunlight requirements
            const sortedPlants = [...zone.plants].sort((a, b) => 
                b.sunlightNeeds.localeCompare(a.sunlightNeeds)
            );

            for (const plant of sortedPlants) {
                const existingPlants = zone.plants.filter(p => 
                    plantPlacements.has(p.id)
                );

                const isOptimal = await this.companionPlanting
                    .optimizePlantPlacement(existingPlants, plant)
                    .toPromise();

                plantPlacements.set(plant.id, isOptimal || false);
            }

            return {
                ...zone,
                plants: zone.plants.filter(plant => 
                    plantPlacements.get(plant.id)
                )
            };
        }));
    }

    /**
     * Calculates final space utilization percentage
     * @param zones Optimized garden zones
     * @param totalArea Total garden area
     * @returns number Space utilization percentage
     */
    private calculateFinalUtilization(zones: IGardenZone[], totalArea: number): number {
        const usedArea = zones.reduce((sum, zone) => 
            sum + zone.area * (zone.plants.length > 0 ? 1 : 0.5), 0
        );
        return Number(((usedArea / totalArea) * 100).toFixed(2));
    }

    /**
     * Retrieves cached layout if valid
     * @param cacheKey Cache key for layout
     * @returns IGardenLayout | null
     */
    private getCachedLayout(cacheKey: string): IGardenLayout | null {
        const cached = this.cache.getString(cacheKey);
        if (!cached) return null;

        const layout = JSON.parse(cached) as IGardenLayout;
        const age = Date.now() - new Date(layout.generatedAt).getTime();

        if (age > OPTIMIZATION_CACHE_TTL * 1000) {
            this.cache.delete(cacheKey);
            return null;
        }

        return layout;
    }

    /**
     * Caches optimized layout
     * @param cacheKey Cache key for layout
     * @param layout Layout to cache
     */
    private cacheLayout(cacheKey: string, layout: IGardenLayout): void {
        this.cache.set(cacheKey, JSON.stringify(layout));
    }

    /**
     * Tracks performance metrics
     * @param metric Metric name
     * @param value Metric value
     */
    private trackPerformance(metric: string, value: number): void {
        this.performanceMetrics.set(metric, value);
        if (value > LAYOUT_GENERATION_TIMEOUT) {
            this.logger.warn(`Performance threshold exceeded for ${metric}: ${value}ms`);
        }
    }
}