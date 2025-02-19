import { jest } from '@jest/globals';
import { gardenService } from '../../services/garden.service';
import { apiService } from '../../services/api.service';
import { Garden, GardenInput, GardenLayout, GardenOptimizationParams, SunlightCondition } from '../../types/garden.types';
import { PlantType } from '../../types/plant.types';

// Mock API service
jest.mock('../../services/api.service');

describe('GardenService', () => {
    // Test data setup
    const mockGardenInput: GardenInput = {
        area: 500,
        zones: [
            {
                area: 200,
                sunlightCondition: SunlightCondition.FULL_SUN,
                plants: [
                    {
                        id: 'plant1',
                        type: PlantType.TOMATOES,
                        spacing: 2,
                        sunlightNeeds: SunlightCondition.FULL_SUN,
                        daysToMaturity: 60,
                        plantedDate: new Date(),
                        lastWateredDate: new Date(),
                        lastFertilizedDate: new Date(),
                        companionPlants: [PlantType.CARROTS],
                        expectedYield: 5,
                        healthStatus: 'GOOD',
                        maintenanceHistory: []
                    }
                ]
            }
        ]
    };

    const mockGarden: Garden = {
        id: 'garden1',
        area: 500,
        zones: [
            {
                id: 'zone1',
                area: 200,
                sunlightCondition: SunlightCondition.FULL_SUN,
                plants: []
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockOptimizationParams: GardenOptimizationParams = {
        targetUtilization: 92,
        minZoneSize: 50,
        defaultSpacing: 1
    };

    const mockLayout: GardenLayout = {
        gardenId: 'garden1',
        spaceUtilization: 92,
        zones: [
            {
                id: 'zone1',
                area: 200,
                sunlightCondition: SunlightCondition.FULL_SUN,
                plants: []
            }
        ],
        generatedAt: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset API service mock
        (apiService.post as jest.Mock).mockReset();
        (apiService.get as jest.Mock).mockReset();
        (apiService.put as jest.Mock).mockReset();
        (apiService.delete as jest.Mock).mockReset();
    });

    describe('createGarden', () => {
        it('should create a garden with valid input', async () => {
            (apiService.post as jest.Mock).mockResolvedValue(mockGarden);

            const result = await gardenService.createGarden(mockGardenInput);

            expect(result).toEqual(mockGarden);
            expect(apiService.post).toHaveBeenCalledWith('/gardens', mockGardenInput, expect.any(Object));
        });

        it('should validate garden area constraints (1-1000 sq ft)', async () => {
            const invalidInput = { ...mockGardenInput, area: 1001 };
            
            await expect(gardenService.createGarden(invalidInput))
                .rejects
                .toThrow('Garden dimensions must be between 1 and 1000 square feet');
        });

        it('should validate sunlight conditions', async () => {
            const invalidInput = {
                ...mockGardenInput,
                zones: [{
                    ...mockGardenInput.zones[0],
                    sunlightCondition: 'INVALID' as SunlightCondition
                }]
            };

            await expect(gardenService.createGarden(invalidInput))
                .rejects
                .toThrow(/Invalid sunlight condition/);
        });

        it('should handle API errors gracefully', async () => {
            (apiService.post as jest.Mock).mockRejectedValue(new Error('API Error'));

            await expect(gardenService.createGarden(mockGardenInput))
                .rejects
                .toMatchObject({
                    code: 'GARDEN_CREATION_ERROR'
                });
        });
    });

    describe('getGardens', () => {
        it('should retrieve all gardens', async () => {
            (apiService.get as jest.Mock).mockResolvedValue([mockGarden]);

            const result = await gardenService.getGardens();

            expect(result).toEqual([mockGarden]);
            expect(apiService.get).toHaveBeenCalledWith('/gardens');
        });

        it('should handle empty garden list', async () => {
            (apiService.get as jest.Mock).mockResolvedValue([]);

            const result = await gardenService.getGardens();

            expect(result).toEqual([]);
        });
    });

    describe('getGardenById', () => {
        it('should retrieve a specific garden', async () => {
            (apiService.get as jest.Mock).mockResolvedValue(mockGarden);

            const result = await gardenService.getGardenById('garden1');

            expect(result).toEqual(mockGarden);
            expect(apiService.get).toHaveBeenCalledWith('/gardens/garden1');
        });

        it('should handle non-existent garden', async () => {
            (apiService.get as jest.Mock).mockRejectedValue(new Error('Garden not found'));

            await expect(gardenService.getGardenById('invalid'))
                .rejects
                .toMatchObject({
                    code: 'GARDEN_FETCH_ERROR'
                });
        });
    });

    describe('updateGarden', () => {
        it('should update garden with valid changes', async () => {
            (apiService.put as jest.Mock).mockResolvedValue(mockGarden);

            const updates = { area: 400 };
            const result = await gardenService.updateGarden('garden1', updates);

            expect(result).toEqual(mockGarden);
            expect(apiService.put).toHaveBeenCalledWith('/gardens/garden1', updates);
        });

        it('should validate updated area constraints', async () => {
            const invalidUpdates = { area: 1001 };

            await expect(gardenService.updateGarden('garden1', invalidUpdates))
                .rejects
                .toThrow('Garden dimensions must be between 1 and 1000 square feet');
        });
    });

    describe('deleteGarden', () => {
        it('should delete an existing garden', async () => {
            (apiService.delete as jest.Mock).mockResolvedValue(undefined);

            await gardenService.deleteGarden('garden1');

            expect(apiService.delete).toHaveBeenCalledWith('/gardens/garden1');
        });

        it('should handle deletion of non-existent garden', async () => {
            (apiService.delete as jest.Mock).mockRejectedValue(new Error('Garden not found'));

            await expect(gardenService.deleteGarden('invalid'))
                .rejects
                .toMatchObject({
                    code: 'GARDEN_DELETE_ERROR'
                });
        });
    });

    describe('generateLayout', () => {
        it('should generate layout within performance requirements', async () => {
            (apiService.post as jest.Mock).mockResolvedValue(mockLayout);

            const startTime = Date.now();
            const result = await gardenService.generateLayout('garden1', mockOptimizationParams);
            const duration = Date.now() - startTime;

            expect(result).toEqual(mockLayout);
            expect(duration).toBeLessThan(3000); // 3s performance requirement
            expect(result.spaceUtilization).toBeGreaterThanOrEqual(92); // 92% utilization target
        });

        it('should validate optimization parameters', async () => {
            const invalidParams = { ...mockOptimizationParams, targetUtilization: 101 };

            await expect(gardenService.generateLayout('garden1', invalidParams))
                .rejects
                .toThrow('Invalid target utilization percentage');
        });

        it('should handle layout generation errors', async () => {
            (apiService.post as jest.Mock).mockRejectedValue(new Error('Layout generation failed'));

            await expect(gardenService.generateLayout('garden1', mockOptimizationParams))
                .rejects
                .toMatchObject({
                    code: 'LAYOUT_GENERATION_ERROR'
                });
        });

        it('should validate generated layout structure', async () => {
            const invalidLayout = { ...mockLayout, spaceUtilization: 101 };
            (apiService.post as jest.Mock).mockResolvedValue(invalidLayout);

            await expect(gardenService.generateLayout('garden1', mockOptimizationParams))
                .rejects
                .toThrow('Invalid space utilization value');
        });
    });
});