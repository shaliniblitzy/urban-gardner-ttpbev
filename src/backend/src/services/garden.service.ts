/**
 * Garden Service
 * @packageVersion 5.0
 * 
 * Core service implementing garden management business logic with enhanced performance
 * monitoring, caching, and validation. Addresses requirements for garden space optimization
 * (F-001) and related functional requirements.
 */

import { Injectable, Logger } from '@nestjs/common'; // @version ^9.0.0
import { CircuitBreaker } from '@nestjs/common'; // @version ^9.0.0
import { GardenRepository } from '../repositories/garden.repository';
import { GardenOptimizerService } from './optimization/garden-optimizer.service';
import { IGarden } from '../interfaces/garden.interface';
import { GARDEN_AREA_LIMITS, SPACE_UTILIZATION_TARGET } from '../constants/garden.constants';

interface OptimizationResult {
    layout: IGarden;
    spaceUtilization: number;
    timestamp: number;
}

interface OptimizationMetrics {
    averageExecutionTime: number;
    successRate: number;
    utilizationImprovement: number;
    totalOptimizations: number;
}

@Injectable()
@CircuitBreaker({ timeout: 3000, maxFailures: 3, resetTimeout: 30000 })
export class GardenService {
    private readonly logger = new Logger(GardenService.name);
    private readonly optimizationCache = new Map<string, OptimizationResult>();
    private readonly performanceMetrics: OptimizationMetrics = {
        averageExecutionTime: 0,
        successRate: 100,
        utilizationImprovement: 0,
        totalOptimizations: 0
    };

    constructor(
        private readonly gardenRepository: GardenRepository,
        private readonly gardenOptimizer: GardenOptimizerService
    ) {
        this.logger.log('Initializing GardenService with enhanced optimization capabilities');
    }

    /**
     * Creates a new garden with optimized layout and comprehensive validation
     * @param gardenData Garden creation data
     * @returns Promise<IGarden>
     */
    async createGarden(gardenData: IGarden): Promise<IGarden> {
        const startTime = Date.now();
        this.logger.debug(`Creating garden with area: ${gardenData.area} sq ft`);

        try {
            // Validate garden input
            this.validateGardenInput(gardenData);

            // Check optimization cache
            const cacheKey = this.generateCacheKey(gardenData);
            const cachedResult = this.getCachedOptimization(cacheKey);
            if (cachedResult) {
                this.logger.debug('Returning cached optimization result');
                return cachedResult.layout;
            }

            // Generate optimized layout
            const optimizedGarden = await this.gardenOptimizer.optimizeGardenLayout(gardenData);

            // Validate optimization results
            if (optimizedGarden.spaceUtilization < SPACE_UTILIZATION_TARGET) {
                throw new Error(`Space utilization below target: ${optimizedGarden.spaceUtilization}%`);
            }

            // Persist garden data
            const createdGarden = await this.gardenRepository.createGarden({
                ...gardenData,
                zones: optimizedGarden.zones
            });

            // Update metrics and cache
            this.updatePerformanceMetrics(startTime, true, optimizedGarden.spaceUtilization);
            this.cacheOptimizationResult(cacheKey, {
                layout: createdGarden,
                spaceUtilization: optimizedGarden.spaceUtilization,
                timestamp: Date.now()
            });

            return createdGarden;
        } catch (error) {
            this.updatePerformanceMetrics(startTime, false);
            this.logger.error(`Garden creation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieves garden by ID with optimization data
     * @param id Garden identifier
     * @returns Promise<IGarden>
     */
    async getGardenById(id: string): Promise<IGarden> {
        this.logger.debug(`Retrieving garden ${id}`);
        const garden = await this.gardenRepository.getGardenById(id);
        
        if (!garden) {
            throw new Error(`Garden with ID ${id} not found`);
        }

        return garden;
    }

    /**
     * Updates existing garden with optimization recalculation
     * @param id Garden identifier
     * @param updateData Partial garden update data
     * @returns Promise<IGarden>
     */
    async updateGarden(id: string, updateData: Partial<IGarden>): Promise<IGarden> {
        const startTime = Date.now();
        this.logger.debug(`Updating garden ${id}`);

        try {
            const existingGarden = await this.getGardenById(id);
            const updatedData = { ...existingGarden, ...updateData };

            // Validate updated garden data
            this.validateGardenInput(updatedData);

            // Reoptimize layout if necessary
            if (this.requiresReoptimization(existingGarden, updateData)) {
                const optimizedGarden = await this.gardenOptimizer.optimizeGardenLayout(updatedData);
                updateData.zones = optimizedGarden.zones;
            }

            // Persist updates
            const updatedGarden = await this.gardenRepository.updateGarden(id, updateData);
            if (!updatedGarden) {
                throw new Error(`Failed to update garden ${id}`);
            }

            // Update metrics
            this.updatePerformanceMetrics(startTime, true);

            return updatedGarden;
        } catch (error) {
            this.updatePerformanceMetrics(startTime, false);
            this.logger.error(`Garden update failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Deletes garden and associated data
     * @param id Garden identifier
     * @returns Promise<boolean>
     */
    async deleteGarden(id: string): Promise<boolean> {
        this.logger.debug(`Deleting garden ${id}`);
        
        try {
            const deleted = await this.gardenRepository.deleteGarden(id);
            if (!deleted) {
                throw new Error(`Failed to delete garden ${id}`);
            }

            // Clear optimization cache
            this.clearGardenCache(id);
            return true;
        } catch (error) {
            this.logger.error(`Garden deletion failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieves current optimization metrics
     * @returns OptimizationMetrics
     */
    getOptimizationMetrics(): OptimizationMetrics {
        return { ...this.performanceMetrics };
    }

    /**
     * Validates garden input parameters
     * @private
     */
    private validateGardenInput(garden: IGarden): void {
        if (!garden.area || garden.area < GARDEN_AREA_LIMITS.MIN_AREA || garden.area > GARDEN_AREA_LIMITS.MAX_AREA) {
            throw new Error(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`);
        }

        if (!garden.zones || garden.zones.length === 0) {
            throw new Error('Garden must have at least one zone');
        }

        const totalZoneArea = garden.zones.reduce((sum, zone) => sum + zone.area, 0);
        if (Math.abs(totalZoneArea - garden.area) > 0.1) {
            throw new Error('Total zone area must match garden area');
        }
    }

    /**
     * Checks if garden requires reoptimization
     * @private
     */
    private requiresReoptimization(
        existingGarden: IGarden,
        updateData: Partial<IGarden>
    ): boolean {
        return !!(
            updateData.area ||
            updateData.zones ||
            Math.abs(existingGarden.area - (updateData.area || existingGarden.area)) > 0.1
        );
    }

    /**
     * Updates performance metrics
     * @private
     */
    private updatePerformanceMetrics(
        startTime: number,
        success: boolean,
        utilization?: number
    ): void {
        const executionTime = Date.now() - startTime;
        this.performanceMetrics.totalOptimizations++;
        this.performanceMetrics.averageExecutionTime = (
            (this.performanceMetrics.averageExecutionTime * (this.performanceMetrics.totalOptimizations - 1)) +
            executionTime
        ) / this.performanceMetrics.totalOptimizations;

        if (!success) {
            this.performanceMetrics.successRate = (
                (this.performanceMetrics.successRate * (this.performanceMetrics.totalOptimizations - 1)) +
                0
            ) / this.performanceMetrics.totalOptimizations;
        }

        if (utilization) {
            this.performanceMetrics.utilizationImprovement = Math.max(
                this.performanceMetrics.utilizationImprovement,
                utilization - SPACE_UTILIZATION_TARGET
            );
        }
    }

    /**
     * Cache management methods
     * @private
     */
    private generateCacheKey(garden: IGarden): string {
        return `${garden.id}_${garden.area}_${JSON.stringify(garden.zones)}`;
    }

    private getCachedOptimization(key: string): OptimizationResult | null {
        const cached = this.optimizationCache.get(key);
        if (!cached || Date.now() - cached.timestamp > 86400000) { // 24 hour TTL
            return null;
        }
        return cached;
    }

    private cacheOptimizationResult(key: string, result: OptimizationResult): void {
        this.optimizationCache.set(key, result);
        this.cleanCache();
    }

    private clearGardenCache(gardenId: string): void {
        for (const [key] of this.optimizationCache) {
            if (key.startsWith(gardenId)) {
                this.optimizationCache.delete(key);
            }
        }
    }

    private cleanCache(): void {
        const now = Date.now();
        for (const [key, value] of this.optimizationCache) {
            if (now - value.timestamp > 86400000) { // 24 hour TTL
                this.optimizationCache.delete(key);
            }
        }
    }
}