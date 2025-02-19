import { jest } from '@jest/globals'; // ^29.0.0
import { PlantService } from '../../src/services/plant.service';
import { PlantRepository } from '../../src/repositories/plant.repository';
import { IPlant } from '../../src/interfaces/plant.interface';
import {
    PLANT_TYPES,
    GROWTH_STAGES,
    SUNLIGHT_REQUIREMENTS,
    DEFAULT_PLANT_SPACING,
    COMPANION_PLANTS
} from '../../src/constants/plant.constants';

// Mock the PlantRepository
jest.mock('../../src/repositories/plant.repository');

describe('PlantService', () => {
    let plantService: PlantService;
    let mockPlantRepository: jest.Mocked<PlantRepository>;
    let mockEnvironmentalData: any;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Create mock repository instance
        mockPlantRepository = new PlantRepository(null) as jest.Mocked<PlantRepository>;

        // Initialize service with mock repository
        plantService = new PlantService(mockPlantRepository, { setContext: jest.fn(), log: jest.fn(), error: jest.fn() });

        // Setup mock environmental data
        mockEnvironmentalData = {
            temperature: 25,
            humidity: 60,
            rainfall: 0,
            windSpeed: 5
        };
    });

    describe('createPlant', () => {
        const validPlantData: IPlant = {
            id: 'test-plant-1',
            type: PLANT_TYPES.TOMATOES,
            growthStage: GROWTH_STAGES.SEEDLING,
            sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
            spacing: 24,
            daysToMaturity: 80,
            plantedDate: new Date(),
            lastWateredDate: new Date(),
            lastFertilizedDate: new Date(),
            companionPlants: [PLANT_TYPES.LETTUCE],
            waterRequirementMl: 500,
            expectedYieldKg: 5
        };

        it('should create a plant with valid data', async () => {
            mockPlantRepository.createPlant.mockResolvedValue(validPlantData);

            const result = await plantService.createPlant(validPlantData);

            expect(result).toEqual(validPlantData);
            expect(mockPlantRepository.createPlant).toHaveBeenCalledWith(expect.objectContaining({
                type: PLANT_TYPES.TOMATOES,
                growthStage: GROWTH_STAGES.SEEDLING
            }));
        });

        it('should throw error for insufficient spacing', async () => {
            const invalidSpacingData = {
                ...validPlantData,
                spacing: 12 // Too small for tomatoes
            };

            await expect(plantService.createPlant(invalidSpacingData))
                .rejects
                .toThrow(`Insufficient spacing for ${PLANT_TYPES.TOMATOES}`);
        });

        it('should throw error for incompatible companion plants', async () => {
            const invalidCompanionData = {
                ...validPlantData,
                companionPlants: [PLANT_TYPES.CARROTS] // Not compatible with tomatoes
            };

            await expect(plantService.createPlant(invalidCompanionData))
                .rejects
                .toThrow('Incompatible companion plants');
        });
    });

    describe('updateGrowthStage', () => {
        const mockPlant: IPlant = {
            id: 'test-plant-1',
            type: PLANT_TYPES.TOMATOES,
            growthStage: GROWTH_STAGES.SEEDLING,
            sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
            spacing: 24,
            daysToMaturity: 80,
            plantedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            lastWateredDate: new Date(),
            lastFertilizedDate: new Date(),
            companionPlants: [PLANT_TYPES.LETTUCE],
            waterRequirementMl: 500,
            expectedYieldKg: 5
        };

        it('should update growth stage based on environmental factors', async () => {
            mockPlantRepository.updatePlantGrowthStage.mockResolvedValue({
                ...mockPlant,
                growthStage: GROWTH_STAGES.GROWING
            });

            const result = await plantService.updateGrowthStage(mockPlant.id, mockEnvironmentalData);

            expect(result.growthStage).toBe(GROWTH_STAGES.GROWING);
            expect(mockPlantRepository.updatePlantGrowthStage).toHaveBeenCalledWith(
                mockPlant.id,
                mockEnvironmentalData,
                expect.any(Object)
            );
        });

        it('should maintain current stage under stress conditions', async () => {
            const stressEnvironment = {
                ...mockEnvironmentalData,
                temperature: 36, // Too hot
                humidity: 15 // Too dry
            };

            mockPlantRepository.updatePlantGrowthStage.mockResolvedValue(mockPlant);

            const result = await plantService.updateGrowthStage(mockPlant.id, stressEnvironment);

            expect(result.growthStage).toBe(GROWTH_STAGES.SEEDLING);
        });

        it('should throw error for non-existent plant', async () => {
            mockPlantRepository.updatePlantGrowthStage.mockResolvedValue(null);

            await expect(plantService.updateGrowthStage('invalid-id', mockEnvironmentalData))
                .rejects
                .toThrow('Plant not found');
        });
    });

    describe('calculateNextCareDate', () => {
        const mockPlant: IPlant = {
            id: 'test-plant-1',
            type: PLANT_TYPES.TOMATOES,
            growthStage: GROWTH_STAGES.GROWING,
            sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
            spacing: 24,
            daysToMaturity: 80,
            plantedDate: new Date(),
            lastWateredDate: new Date(),
            lastFertilizedDate: new Date(),
            companionPlants: [PLANT_TYPES.LETTUCE],
            waterRequirementMl: 500,
            expectedYieldKg: 5
        };

        beforeEach(() => {
            mockPlantRepository.getPlantById.mockResolvedValue(mockPlant);
        });

        it('should calculate next watering date with environmental adjustments', async () => {
            const result = await plantService.calculateNextCareDate(mockPlant.id, 'watering');
            
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(mockPlant.lastWateredDate.getTime());
        });

        it('should adjust watering frequency for high temperature', async () => {
            const hotEnvironment = {
                ...mockEnvironmentalData,
                temperature: 32
            };

            mockPlantRepository.getPlantById.mockResolvedValue({
                ...mockPlant,
                environmentalFactors: hotEnvironment
            });

            const result = await plantService.calculateNextCareDate(mockPlant.id, 'watering');
            const daysDiff = (result.getTime() - mockPlant.lastWateredDate.getTime()) / (1000 * 60 * 60 * 24);

            expect(daysDiff).toBeLessThan(3); // Should water more frequently in hot weather
        });

        it('should calculate next fertilizing date based on growth stage', async () => {
            const result = await plantService.calculateNextCareDate(mockPlant.id, 'fertilizing');
            
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(mockPlant.lastFertilizedDate.getTime());
        });
    });

    describe('companion planting compatibility', () => {
        it('should validate compatible plant combinations', async () => {
            const plantData: IPlant = {
                id: 'test-plant-1',
                type: PLANT_TYPES.TOMATOES,
                growthStage: GROWTH_STAGES.SEEDLING,
                sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                spacing: 24,
                daysToMaturity: 80,
                plantedDate: new Date(),
                lastWateredDate: new Date(),
                lastFertilizedDate: new Date(),
                companionPlants: [PLANT_TYPES.LETTUCE],
                waterRequirementMl: 500,
                expectedYieldKg: 5
            };

            mockPlantRepository.createPlant.mockResolvedValue(plantData);

            const result = await plantService.createPlant(plantData);

            expect(result.companionPlants).toContain(PLANT_TYPES.LETTUCE);
            expect(mockPlantRepository.createPlant).toHaveBeenCalled();
        });

        it('should reject incompatible plant combinations', async () => {
            const invalidPlantData: IPlant = {
                ...mockPlant,
                companionPlants: [PLANT_TYPES.CARROTS] // Incompatible with tomatoes
            };

            await expect(plantService.createPlant(invalidPlantData))
                .rejects
                .toThrow(/Incompatible companion plants/);
        });
    });

    describe('environmental impact assessment', () => {
        const mockPlant: IPlant = {
            id: 'test-plant-1',
            type: PLANT_TYPES.TOMATOES,
            growthStage: GROWTH_STAGES.GROWING,
            sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
            spacing: 24,
            daysToMaturity: 80,
            plantedDate: new Date(),
            lastWateredDate: new Date(),
            lastFertilizedDate: new Date(),
            companionPlants: [PLANT_TYPES.LETTUCE],
            waterRequirementMl: 500,
            expectedYieldKg: 5
        };

        it('should assess plant health under normal conditions', async () => {
            mockPlantRepository.getPlantById.mockResolvedValue(mockPlant);

            const result = await plantService.updateGrowthStage(mockPlant.id, mockEnvironmentalData);

            expect(result).toBeDefined();
            expect(mockPlantRepository.updatePlantGrowthStage).toHaveBeenCalledWith(
                mockPlant.id,
                mockEnvironmentalData,
                expect.objectContaining({
                    leafColor: 'green',
                    stemStrength: expect.any(Number),
                    pestPresence: false,
                    diseaseSymptoms: expect.any(Array)
                })
            );
        });

        it('should detect stress under extreme conditions', async () => {
            const extremeConditions = {
                temperature: 38, // Too hot
                humidity: 15,   // Too dry
                rainfall: 0,
                windSpeed: 35   // Too windy
            };

            mockPlantRepository.getPlantById.mockResolvedValue(mockPlant);

            const result = await plantService.updateGrowthStage(mockPlant.id, extremeConditions);

            expect(result.growthStage).toBe(mockPlant.growthStage); // Should not progress under stress
        });
    });
});