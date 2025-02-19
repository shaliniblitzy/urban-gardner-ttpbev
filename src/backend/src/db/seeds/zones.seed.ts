/**
 * Garden Zone Seeds
 * @packageVersion 5.0
 * 
 * Provides initial zone data for garden planning with predefined sunlight conditions
 * and sample layouts, ensuring optimal space utilization and plant growth conditions.
 * Implements requirements F-001-RQ-002 for sunlight condition specification.
 */

import { v4 as uuidv4 } from 'uuid'; // @version 9.0.0
import { 
    IGardenZone,
    SunlightCondition,
    ZoneLocation
} from '../../interfaces/garden.interface';
import { 
    GARDEN_AREA_LIMITS,
    SUNLIGHT_CONDITIONS,
    MIN_ZONE_SIZE,
    SPACE_UTILIZATION_TARGET
} from '../../constants/garden.constants';

/**
 * Default zone proportions for optimal garden layout
 * Based on horticultural best practices and sunlight distribution
 */
const ZONE_PROPORTIONS = {
    [SUNLIGHT_CONDITIONS.FULL_SUN]: 0.4,      // 40% full sun for sun-loving plants
    [SUNLIGHT_CONDITIONS.PARTIAL_SHADE]: 0.35, // 35% partial shade for adaptable plants
    [SUNLIGHT_CONDITIONS.FULL_SHADE]: 0.25    // 25% full shade for shade-tolerant plants
} as const;

/**
 * Zone location mapping for strategic placement
 */
const ZONE_LOCATIONS: Record<SunlightCondition, ZoneLocation> = {
    [SUNLIGHT_CONDITIONS.FULL_SUN]: { x: 0, y: 0 },       // North side for maximum sun
    [SUNLIGHT_CONDITIONS.PARTIAL_SHADE]: { x: 0, y: 0.4 }, // Middle area
    [SUNLIGHT_CONDITIONS.FULL_SHADE]: { x: 0, y: 0.75 }   // South side for shade
};

/**
 * Validates zone configuration against area constraints and distribution
 * @param zones Array of garden zones to validate
 * @returns boolean indicating if configuration is valid
 */
export const validateZoneConfiguration = (zones: IGardenZone[]): boolean => {
    // Calculate total area
    const totalArea = zones.reduce((sum, zone) => sum + zone.area, 0);

    // Validate against area constraints
    if (totalArea > GARDEN_AREA_LIMITS.MAX_AREA || totalArea < GARDEN_AREA_LIMITS.MIN_AREA) {
        return false;
    }

    // Validate individual zones
    return zones.every(zone => (
        zone.area >= MIN_ZONE_SIZE && 
        Object.values(SUNLIGHT_CONDITIONS).includes(zone.sunlightCondition)
    ));
};

/**
 * Generates default garden zones with optimal distribution of sunlight conditions
 * @param totalArea Total garden area in square feet
 * @returns Promise<IGardenZone[]> Array of configured garden zones
 */
export const generateDefaultZones = async (totalArea: number): Promise<IGardenZone[]> => {
    // Validate input area
    if (!totalArea || totalArea < GARDEN_AREA_LIMITS.MIN_AREA || totalArea > GARDEN_AREA_LIMITS.MAX_AREA) {
        throw new Error(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} square feet`);
    }

    // Generate zones based on proportions
    const zones: IGardenZone[] = Object.entries(ZONE_PROPORTIONS).map(([condition, proportion]) => ({
        id: uuidv4(),
        area: Math.max(Math.floor(totalArea * proportion), MIN_ZONE_SIZE),
        sunlightCondition: condition as SunlightCondition,
        location: ZONE_LOCATIONS[condition as SunlightCondition],
        plants: [] // Initially empty, to be populated during garden planning
    }));

    // Validate generated configuration
    if (!validateZoneConfiguration(zones)) {
        throw new Error('Failed to generate valid zone configuration');
    }

    return zones;
};

/**
 * Default zones for database seeding
 * Provides a starting point for garden planning with 100 sq ft total area
 */
export const defaultZones: IGardenZone[] = [
    {
        id: uuidv4(),
        area: 40, // 40 sq ft for full sun
        sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
        location: ZONE_LOCATIONS[SUNLIGHT_CONDITIONS.FULL_SUN],
        plants: []
    },
    {
        id: uuidv4(),
        area: 35, // 35 sq ft for partial shade
        sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE,
        location: ZONE_LOCATIONS[SUNLIGHT_CONDITIONS.PARTIAL_SHADE],
        plants: []
    },
    {
        id: uuidv4(),
        area: 25, // 25 sq ft for full shade
        sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SHADE,
        location: ZONE_LOCATIONS[SUNLIGHT_CONDITIONS.FULL_SHADE],
        plants: []
    }
];

// Validate default zones on module load
if (!validateZoneConfiguration(defaultZones)) {
    throw new Error('Invalid default zone configuration');
}