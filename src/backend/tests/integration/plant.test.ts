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
import mongoose from 'mongoose';
import { Logger } from '@nestjs/common';
import supertest from 'supertest';

describe('Plant Management Integration Tests', () => {
    let plantService: PlantService;
    let plantRepository: PlantRepository;
    let logger: Logger;
    let mongoConnection: typeof mongoose;

    // Test data
    const testEnvironmentalFactors = {
        temperature: 25,
        humidity: 60,
        rainfall: 0,
        windSpeed: 5
    };

    const testSoilConditions = {
        moisture: 0.6,
        pH: 6.5,
        nutrients: {
            nitrogen: 0.5,
            phosphorus: 0.5,
            potassium: 0.5
        }
    };

    beforeAll(async () => {
        // Connect to test database
        mongoConnection = await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/garden-planner-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Initialize logger
        logger = new Logger('PlantIntegrationTest');

        // Initialize repository and service
        plantRepository = new PlantRepository(logger);
        plantService = new PlantService(plantRepository, logger);
    });

    afterAll(async () => {
        // Cleanup and close connection
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clear test data before each test
        await mongoose.connection.collection('plants').deleteMany({});
    });

    describe('Plant Creation and Lifecycle', () => {
        it('should create a new plant with valid data and initialize growth tracking', async () => {
            const plantData: Partial<IPlant> = {
                type: PLANT_TYPES.TOMATOES,
                sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
                waterRequirementMl: 500,
                expectedYieldKg: 3,
                companionPlants: [PLANT_TYPES.LETTUCE]
            };

            const createdPlant = await plantService.createPlant(plantData as IPlant);

            expect(createdPlant).toBeDefined();
            expect(createdPlant.id).toBeDefined();
            expect(createdPlant.growthStage).toBe(GROWTH_STAGES.SEEDLING);
            expect(createdPlant.plantedDate).toBeDefined();
            expect(createdPlant.lastWateredDate).toBeDefined();
            expect(createdPlant.lastFertilizedDate).toBeDefined();
        });

        it('should reject plant creation with invalid spacing', async () => {
            const invalidPlantData: Partial<IPlant> = {
                type: PLANT_TYPES.TOMATOES,
                sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                spacing: 5, // Too small for tomatoes
                waterRequirementMl: 500,
                expectedYieldKg: 3
            };

            await expect(plantService.createPlant(invalidPlantData as IPlant))
                .rejects
                .toThrow(/Insufficient spacing/);
        });
    });

    describe('Environmental Impact and Growth Tracking', () => {
        let testPlant: IPlant;

        beforeEach(async () => {
            // Create test plant for environmental testing
            const plantData: Partial<IPlant> = {
                type: PLANT_TYPES.TOMATOES,
                sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
                waterRequirementMl: 500,
                expectedYieldKg: 3
            };
            testPlant = await plantService.createPlant(plantData as IPlant);
        });

        it('should update growth stage based on environmental conditions', async () => {
            const updatedPlant = await plantService.updateGrowthStage(
                testPlant.id,
                {
                    ...testEnvironmentalFactors,
                    temperature: 35 // High temperature stress
                }
            );

            expect(updatedPlant).toBeDefined();
            expect(updatedPlant.growthStage).toBe(GROWTH_STAGES.SEEDLING);
            // Growth stage progression delayed due to temperature stress
        });

        it('should adjust care schedule based on environmental factors', async () => {
            const nextWateringDate = await plantService.calculateNextCareDate(
                testPlant.id,
                'watering'
            );

            expect(nextWateringDate).toBeDefined();
            expect(nextWateringDate.getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe('Space Optimization and Companion Planting', () => {
        it('should validate companion plant compatibility', async () => {
            const plantData: Partial<IPlant> = {
                type: PLANT_TYPES.TOMATOES,
                sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
                waterRequirementMl: 500,
                expectedYieldKg: 3,
                companionPlants: [PLANT_TYPES.CARROTS] // Invalid companion for tomatoes
            };

            await expect(plantService.createPlant(plantData as IPlant))
                .rejects
                .toThrow(/Incompatible companion plants/);
        });

        it('should optimize plant placement with spacing requirements', async () => {
            // Create multiple plants to test spacing optimization
            const plants = await Promise.all([
                plantService.createPlant({
                    type: PLANT_TYPES.TOMATOES,
                    sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                    spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
                    waterRequirementMl: 500,
                    expectedYieldKg: 3
                } as IPlant),
                plantService.createPlant({
                    type: PLANT_TYPES.LETTUCE,
                    sunlightNeeds: SUNLIGHT_REQUIREMENTS.PARTIAL_SHADE,
                    spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.LETTUCE],
                    waterRequirementMl: 300,
                    expectedYieldKg: 1
                } as IPlant)
            ]);

            expect(plants).toHaveLength(2);
            expect(plants[0].spacing).toBeGreaterThanOrEqual(DEFAULT_PLANT_SPACING[plants[0].type]);
            expect(plants[1].spacing).toBeGreaterThanOrEqual(DEFAULT_PLANT_SPACING[plants[1].type]);
        });
    });

    describe('Maintenance Schedule Management', () => {
        let testPlant: IPlant;

        beforeEach(async () => {
            testPlant = await plantService.createPlant({
                type: PLANT_TYPES.TOMATOES,
                sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
                waterRequirementMl: 500,
                expectedYieldKg: 3
            } as IPlant);
        });

        it('should calculate next watering date with environmental adjustments', async () => {
            const nextWateringDate = await plantService.calculateNextCareDate(
                testPlant.id,
                'watering'
            );

            expect(nextWateringDate).toBeDefined();
            expect(nextWateringDate.getTime()).toBeGreaterThan(testPlant.lastWateredDate.getTime());
        });

        it('should calculate next fertilizing date based on growth stage', async () => {
            const nextFertilizingDate = await plantService.calculateNextCareDate(
                testPlant.id,
                'fertilizing'
            );

            expect(nextFertilizingDate).toBeDefined();
            expect(nextFertilizingDate.getTime()).toBeGreaterThan(testPlant.lastFertilizedDate.getTime());
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle non-existent plant queries gracefully', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(plantService.getPlantById(nonExistentId))
                .rejects
                .toThrow(/Plant not found/);
        });

        it('should handle database connection errors', async () => {
            // Simulate database connection error
            await mongoose.connection.close();

            await expect(plantService.createPlant({
                type: PLANT_TYPES.TOMATOES,
                sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
                spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
                waterRequirementMl: 500,
                expectedYieldKg: 3
            } as IPlant)).rejects.toThrow();

            // Restore connection for other tests
            await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/garden-planner-test');
        });
    });
});