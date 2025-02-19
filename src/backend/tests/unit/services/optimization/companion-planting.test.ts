import { Test, TestingModule } from '@nestjs/testing';
import { CompanionPlantingService } from '../../../src/services/optimization/companion-planting.service';
import { IPlant } from '../../../src/interfaces/plant.interface';
import { PLANT_TYPES, SUNLIGHT_REQUIREMENTS } from '../../../src/constants/plant.constants';
import { firstValueFrom } from 'rxjs';

describe('CompanionPlantingService', () => {
  let companionPlantingService: CompanionPlantingService;
  let module: TestingModule;

  /**
   * Helper function to create test plant objects
   * @param type Plant type
   * @param spacing Spacing requirement in inches
   * @param companions Array of companion plant types
   */
  const createTestPlant = (
    type: PLANT_TYPES,
    spacing: number,
    companions: PLANT_TYPES[] = []
  ): IPlant => ({
    id: `test-${type}`,
    type,
    spacing,
    sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
    growthStage: 'growing',
    daysToMaturity: 60,
    plantedDate: new Date(),
    lastWateredDate: new Date(),
    lastFertilizedDate: new Date(),
    companionPlants: companions,
    waterRequirementMl: 500,
    expectedYieldKg: 2
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [CompanionPlantingService],
    }).compile();

    companionPlantingService = module.get<CompanionPlantingService>(CompanionPlantingService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('optimizePlantPlacement', () => {
    it('should return true for compatible plant combinations', async () => {
      const existingPlants = [
        createTestPlant(PLANT_TYPES.TOMATOES, 24)
      ];
      const newPlant = createTestPlant(PLANT_TYPES.LETTUCE, 12);

      const result = await firstValueFrom(
        companionPlantingService.optimizePlantPlacement(existingPlants, newPlant)
      );

      expect(result).toBe(true);
    });

    it('should return false for incompatible plant combinations', async () => {
      const existingPlants = [
        createTestPlant(PLANT_TYPES.CARROTS, 3)
      ];
      const newPlant = createTestPlant(PLANT_TYPES.CARROTS, 3);

      const result = await firstValueFrom(
        companionPlantingService.optimizePlantPlacement(existingPlants, newPlant)
      );

      expect(result).toBe(false);
    });

    it('should handle empty existing plants array', async () => {
      const existingPlants: IPlant[] = [];
      const newPlant = createTestPlant(PLANT_TYPES.TOMATOES, 24);

      const result = await firstValueFrom(
        companionPlantingService.optimizePlantPlacement(existingPlants, newPlant)
      );

      expect(result).toBe(false);
    });

    it('should handle invalid input parameters', async () => {
      const result = await firstValueFrom(
        companionPlantingService.optimizePlantPlacement(null as any, null as any)
      );

      expect(result).toBe(false);
    });
  });

  describe('checkCompatibility', () => {
    it('should return true for known companion plants', () => {
      const result = companionPlantingService.checkCompatibility(
        PLANT_TYPES.TOMATOES,
        PLANT_TYPES.LETTUCE
      );

      expect(result).toBe(true);
    });

    it('should return false for non-companion plants', () => {
      const result = companionPlantingService.checkCompatibility(
        PLANT_TYPES.TOMATOES,
        PLANT_TYPES.CARROTS
      );

      expect(result).toBe(false);
    });

    it('should return false for same plant type', () => {
      const result = companionPlantingService.checkCompatibility(
        PLANT_TYPES.TOMATOES,
        PLANT_TYPES.TOMATOES
      );

      expect(result).toBe(false);
    });

    it('should handle invalid plant types gracefully', () => {
      const result = companionPlantingService.checkCompatibility(
        'INVALID' as PLANT_TYPES,
        PLANT_TYPES.TOMATOES
      );

      expect(result).toBe(false);
    });
  });

  describe('calculateOptimalSpacing', () => {
    it('should calculate correct spacing for companion plants', () => {
      const plant1 = createTestPlant(PLANT_TYPES.TOMATOES, 24);
      const plant2 = createTestPlant(PLANT_TYPES.LETTUCE, 12);

      const spacing = companionPlantingService.calculateOptimalSpacing(plant1, plant2);

      // Expect 75% of larger spacing due to companion planting adjustment
      expect(spacing).toBe(18);
    });

    it('should maintain minimum spacing for non-companion plants', () => {
      const plant1 = createTestPlant(PLANT_TYPES.TOMATOES, 24);
      const plant2 = createTestPlant(PLANT_TYPES.CARROTS, 3);

      const spacing = companionPlantingService.calculateOptimalSpacing(plant1, plant2);

      // Should use larger spacing without reduction
      expect(spacing).toBe(24);
    });

    it('should handle equal spacing requirements', () => {
      const plant1 = createTestPlant(PLANT_TYPES.LETTUCE, 12);
      const plant2 = createTestPlant(PLANT_TYPES.LETTUCE, 12);

      const spacing = companionPlantingService.calculateOptimalSpacing(plant1, plant2);

      expect(spacing).toBe(12);
    });

    it('should return -1 for invalid input', () => {
      const spacing = companionPlantingService.calculateOptimalSpacing(
        null as any,
        null as any
      );

      expect(spacing).toBe(-1);
    });
  });

  describe('performance requirements', () => {
    it('should optimize placement within 3-second limit', async () => {
      const startTime = Date.now();
      
      const existingPlants = Array(50).fill(null).map(() => 
        createTestPlant(PLANT_TYPES.TOMATOES, 24)
      );
      const newPlant = createTestPlant(PLANT_TYPES.LETTUCE, 12);

      await firstValueFrom(
        companionPlantingService.optimizePlantPlacement(existingPlants, newPlant)
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });
  });
});