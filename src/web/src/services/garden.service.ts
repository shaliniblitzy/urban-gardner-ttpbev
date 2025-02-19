import { Garden, GardenInput, GardenLayout, GardenOptimizationParams } from '../types/garden.types';
import { apiService, ApiError } from './api.service';
import { SunlightCondition } from '../types/zone.types';
import { PlantType } from '../types/plant.types';
import axios, { AxiosError } from 'axios'; // ^1.6.0

// API endpoints for garden operations
const API_ENDPOINTS = {
    CREATE_GARDEN: '/gardens',
    GET_GARDENS: '/gardens',
    GET_GARDEN: '/gardens/:id',
    UPDATE_GARDEN: '/gardens/:id',
    DELETE_GARDEN: '/gardens/:id',
    GENERATE_LAYOUT: '/gardens/:id/layout'
};

// Validation constants
const GARDEN_CONSTRAINTS = {
    MIN_AREA: 1,
    MAX_AREA: 1000,
    MIN_ZONE_SIZE: 1,
    MIN_PLANT_SPACING: 0.5
};

// Error messages
const ERROR_MESSAGES = {
    INVALID_DIMENSIONS: 'Garden dimensions must be between 1 and 1000 square feet',
    INVALID_OPTIMIZATION: 'Invalid optimization parameters provided',
    LAYOUT_GENERATION_FAILED: 'Failed to generate garden layout',
    INVALID_ZONE: 'Invalid zone configuration provided',
    INVALID_GARDEN_ID: 'Invalid garden ID provided'
};

/**
 * Service responsible for handling garden-related operations
 * Provides interface between frontend components and backend API
 */
class GardenService {
    /**
     * Creates a new garden with comprehensive input validation
     * @param gardenInput Garden creation parameters
     * @returns Promise resolving to created garden
     * @throws ApiError for validation or server errors
     */
    public async createGarden(gardenInput: GardenInput): Promise<Garden> {
        try {
            // Validate garden dimensions
            this.validateGardenDimensions(gardenInput.area);

            // Validate zones
            this.validateZones(gardenInput.zones);

            // Create garden through API
            const garden = await apiService.post<GardenInput, Garden>(
                API_ENDPOINTS.CREATE_GARDEN,
                gardenInput,
                {
                    headers: {
                        'X-Operation': 'garden-creation'
                    }
                }
            );

            return garden;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError({
                code: 'GARDEN_CREATION_ERROR',
                message: (error as Error).message,
                context: { gardenInput }
            });
        }
    }

    /**
     * Retrieves all gardens for the current user
     * @returns Promise resolving to array of gardens
     */
    public async getGardens(): Promise<Garden[]> {
        try {
            return await apiService.get<Garden[]>(API_ENDPOINTS.GET_GARDENS);
        } catch (error) {
            throw new ApiError({
                code: 'GARDEN_FETCH_ERROR',
                message: 'Failed to retrieve gardens',
                context: { error }
            });
        }
    }

    /**
     * Retrieves a specific garden by ID
     * @param id Garden identifier
     * @returns Promise resolving to garden details
     */
    public async getGardenById(id: string): Promise<Garden> {
        try {
            const endpoint = API_ENDPOINTS.GET_GARDEN.replace(':id', id);
            return await apiService.get<Garden>(endpoint);
        } catch (error) {
            throw new ApiError({
                code: 'GARDEN_FETCH_ERROR',
                message: `Failed to retrieve garden with ID: ${id}`,
                context: { id, error }
            });
        }
    }

    /**
     * Updates an existing garden
     * @param id Garden identifier
     * @param gardenInput Updated garden data
     * @returns Promise resolving to updated garden
     */
    public async updateGarden(id: string, gardenInput: Partial<GardenInput>): Promise<Garden> {
        try {
            // Validate garden dimensions if provided
            if (gardenInput.area !== undefined) {
                this.validateGardenDimensions(gardenInput.area);
            }

            // Validate zones if provided
            if (gardenInput.zones) {
                this.validateZones(gardenInput.zones);
            }

            const endpoint = API_ENDPOINTS.UPDATE_GARDEN.replace(':id', id);
            return await apiService.put<Partial<GardenInput>, Garden>(endpoint, gardenInput);
        } catch (error) {
            throw new ApiError({
                code: 'GARDEN_UPDATE_ERROR',
                message: `Failed to update garden with ID: ${id}`,
                context: { id, gardenInput, error }
            });
        }
    }

    /**
     * Deletes a garden by ID
     * @param id Garden identifier
     * @returns Promise resolving when deletion is complete
     */
    public async deleteGarden(id: string): Promise<void> {
        try {
            const endpoint = API_ENDPOINTS.DELETE_GARDEN.replace(':id', id);
            await apiService.delete(endpoint);
        } catch (error) {
            throw new ApiError({
                code: 'GARDEN_DELETE_ERROR',
                message: `Failed to delete garden with ID: ${id}`,
                context: { id, error }
            });
        }
    }

    /**
     * Generates optimized layout for a garden
     * @param gardenId Garden identifier
     * @param optimizationParams Layout optimization parameters
     * @returns Promise resolving to optimized garden layout
     */
    public async generateLayout(
        gardenId: string,
        optimizationParams: GardenOptimizationParams
    ): Promise<GardenLayout> {
        try {
            // Validate optimization parameters
            this.validateOptimizationParams(optimizationParams);

            const endpoint = API_ENDPOINTS.GENERATE_LAYOUT.replace(':id', gardenId);
            const layout = await apiService.post<GardenOptimizationParams, GardenLayout>(
                endpoint,
                optimizationParams,
                {
                    timeout: 30000, // Extended timeout for complex calculations
                }
            );

            // Validate generated layout
            this.validateGeneratedLayout(layout);

            return layout;
        } catch (error) {
            throw new ApiError({
                code: 'LAYOUT_GENERATION_ERROR',
                message: ERROR_MESSAGES.LAYOUT_GENERATION_FAILED,
                context: { gardenId, optimizationParams, error }
            });
        }
    }

    /**
     * Validates garden dimensions
     * @param area Garden area in square feet
     * @throws Error if dimensions are invalid
     */
    private validateGardenDimensions(area: number): void {
        if (
            !Number.isFinite(area) ||
            area < GARDEN_CONSTRAINTS.MIN_AREA ||
            area > GARDEN_CONSTRAINTS.MAX_AREA
        ) {
            throw new Error(ERROR_MESSAGES.INVALID_DIMENSIONS);
        }
    }

    /**
     * Validates garden zones configuration
     * @param zones Array of garden zones
     * @throws Error if zone configuration is invalid
     */
    private validateZones(zones: Array<Omit<Garden['zones'][0], 'id'>>): void {
        if (!Array.isArray(zones) || zones.length === 0) {
            throw new Error(ERROR_MESSAGES.INVALID_ZONE);
        }

        zones.forEach(zone => {
            // Validate zone area
            if (
                !Number.isFinite(zone.area) ||
                zone.area < GARDEN_CONSTRAINTS.MIN_ZONE_SIZE
            ) {
                throw new Error(`Invalid zone area: ${zone.area}`);
            }

            // Validate sunlight condition
            if (!Object.values(SunlightCondition).includes(zone.sunlightCondition)) {
                throw new Error(`Invalid sunlight condition: ${zone.sunlightCondition}`);
            }

            // Validate plants if present
            if (zone.plants) {
                zone.plants.forEach(plant => {
                    if (!Object.values(PlantType).includes(plant.type)) {
                        throw new Error(`Invalid plant type: ${plant.type}`);
                    }
                });
            }
        });
    }

    /**
     * Validates optimization parameters
     * @param params Optimization parameters
     * @throws Error if parameters are invalid
     */
    private validateOptimizationParams(params: GardenOptimizationParams): void {
        if (
            !Number.isFinite(params.targetUtilization) ||
            params.targetUtilization < 0 ||
            params.targetUtilization > 100
        ) {
            throw new Error('Invalid target utilization percentage');
        }

        if (
            !Number.isFinite(params.minZoneSize) ||
            params.minZoneSize < GARDEN_CONSTRAINTS.MIN_ZONE_SIZE
        ) {
            throw new Error('Invalid minimum zone size');
        }

        if (
            !Number.isFinite(params.defaultSpacing) ||
            params.defaultSpacing < GARDEN_CONSTRAINTS.MIN_PLANT_SPACING
        ) {
            throw new Error('Invalid default plant spacing');
        }
    }

    /**
     * Validates generated garden layout
     * @param layout Generated garden layout
     * @throws Error if layout is invalid
     */
    private validateGeneratedLayout(layout: GardenLayout): void {
        if (!layout.gardenId || !layout.zones || !Array.isArray(layout.zones)) {
            throw new Error('Invalid layout structure');
        }

        if (
            !Number.isFinite(layout.spaceUtilization) ||
            layout.spaceUtilization < 0 ||
            layout.spaceUtilization > 100
        ) {
            throw new Error('Invalid space utilization value');
        }
    }
}

// Export singleton instance
export const gardenService = new GardenService();