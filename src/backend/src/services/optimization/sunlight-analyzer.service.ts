import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { IGarden, IGardenZone } from '../../interfaces/garden.interface';
import { IPlant } from '../../interfaces/plant.interface';
import { SUNLIGHT_CONDITIONS, SUNLIGHT_HOURS } from '../../constants/garden.constants';

/**
 * Service responsible for analyzing and validating sunlight conditions in garden zones
 * Supports the garden space optimization feature (F-001) and sunlight condition assessment
 * @version 1.0.0
 */
@Injectable()
export class SunlightAnalyzerService {
    private readonly logger = new Logger(SunlightAnalyzerService.name);

    constructor() {
        this.logger.log('Initializing SunlightAnalyzerService');
    }

    /**
     * Analyzes sunlight distribution across garden zones
     * Validates sunlight conditions and provides optimization recommendations
     * @param garden Garden configuration to analyze
     * @returns Validation result with optional recommendations
     */
    async analyzeSunlightDistribution(garden: IGarden): Promise<{ 
        isValid: boolean; 
        recommendations?: string[] 
    }> {
        this.logger.debug(`Analyzing sunlight distribution for garden ${garden.id}`);

        if (!garden.zones || garden.zones.length === 0) {
            return {
                isValid: false,
                recommendations: ['Garden must have at least one defined zone']
            };
        }

        const recommendations: string[] = [];
        let totalValidZones = 0;
        let totalArea = 0;

        for (const zone of garden.zones) {
            if (this.validateZoneSunlight(zone)) {
                totalValidZones++;
            } else {
                recommendations.push(
                    `Zone ${zone.id} has invalid sunlight condition: ${zone.sunlightCondition}`
                );
            }
            totalArea += zone.area;
        }

        // Check if total zone area matches garden area
        if (Math.abs(totalArea - garden.area) > 0.1) { // Allow 0.1 sq ft tolerance
            recommendations.push('Total zone area does not match garden area');
        }

        // Ensure balanced sunlight distribution
        const hasFullSun = garden.zones.some(
            zone => zone.sunlightCondition === SUNLIGHT_CONDITIONS.FULL_SUN
        );
        if (!hasFullSun) {
            recommendations.push(
                'Garden layout should include at least one full sun zone for optimal plant growth'
            );
        }

        return {
            isValid: totalValidZones === garden.zones.length,
            recommendations: recommendations.length > 0 ? recommendations : undefined
        };
    }

    /**
     * Validates sunlight conditions for a specific garden zone
     * @param zone Garden zone to validate
     * @returns Whether zone sunlight conditions are valid
     */
    validateZoneSunlight(zone: IGardenZone): boolean {
        this.logger.debug(`Validating sunlight for zone ${zone.id}`);

        // Validate sunlight condition is a recognized value
        if (!Object.values(SUNLIGHT_CONDITIONS).includes(zone.sunlightCondition)) {
            this.logger.warn(`Invalid sunlight condition: ${zone.sunlightCondition}`);
            return false;
        }

        // Validate zone has sufficient area for planting
        if (zone.area <= 0) {
            this.logger.warn(`Invalid zone area: ${zone.area}`);
            return false;
        }

        return true;
    }

    /**
     * Calculates optimal plant placement based on sunlight requirements
     * @param zone Garden zone to analyze
     * @param plants Plants to be placed in the zone
     * @returns Map of plant IDs to their optimal positions
     */
    async calculateOptimalPlantPlacement(
        zone: IGardenZone,
        plants: IPlant[]
    ): Promise<Map<string, { x: number; y: number }>> {
        this.logger.debug(`Calculating optimal placement for ${plants.length} plants in zone ${zone.id}`);

        const placement = new Map<string, { x: number; y: number }>();
        const sunlightHours = this.getSunlightHours(zone.sunlightCondition);

        // Sort plants by sunlight needs (highest to lowest)
        const sortedPlants = [...plants].sort((a, b) => {
            const aHours = this.getSunlightHours(a.sunlightNeeds);
            const bHours = this.getSunlightHours(b.sunlightNeeds);
            return bHours - aHours;
        });

        // Calculate grid dimensions based on zone area
        const gridSize = Math.sqrt(zone.area);
        let currentX = 0;
        let currentY = 0;

        for (const plant of sortedPlants) {
            // Skip plants that require more sunlight than zone provides
            if (this.getSunlightHours(plant.sunlightNeeds) > sunlightHours) {
                this.logger.warn(
                    `Plant ${plant.id} requires more sunlight than zone ${zone.id} provides`
                );
                continue;
            }

            // Place plant in next available position
            placement.set(plant.id, { x: currentX, y: currentY });

            // Update position for next plant
            currentX += plant.spacing / 12; // Convert inches to feet
            if (currentX > gridSize) {
                currentX = 0;
                currentY += plant.spacing / 12;
            }

            // Check if we've exceeded zone boundaries
            if (currentY > gridSize) {
                this.logger.warn('Zone capacity exceeded');
                break;
            }
        }

        return placement;
    }

    /**
     * Gets required sunlight hours for a given condition
     * @param condition Sunlight condition to check
     * @returns Required hours of sunlight
     */
    private getSunlightHours(condition: string): number {
        switch (condition) {
            case SUNLIGHT_CONDITIONS.FULL_SUN:
                return SUNLIGHT_HOURS.FULL_SUN;
            case SUNLIGHT_CONDITIONS.PARTIAL_SHADE:
                return SUNLIGHT_HOURS.PARTIAL_SHADE;
            case SUNLIGHT_CONDITIONS.FULL_SHADE:
                return SUNLIGHT_HOURS.FULL_SHADE;
            default:
                this.logger.error(`Unknown sunlight condition: ${condition}`);
                return 0;
        }
    }
}