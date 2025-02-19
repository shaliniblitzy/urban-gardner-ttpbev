import { Test, TestingModule } from '@nestjs/testing'; // ^8.0.0
import { INestApplication } from '@nestjs/common'; // ^8.0.0
import request from 'supertest'; // ^6.1.3
import { PlantController } from '../../src/controllers/plant.controller';
import { IPlant } from '../../src/interfaces/plant.interface';
import {
  PLANT_TYPES,
  GROWTH_STAGES,
  SUNLIGHT_REQUIREMENTS,
  DEFAULT_PLANT_SPACING,
  COMPANION_PLANTS
} from '../../src/constants/plant.constants';

describe('Plant Management E2E Tests', () => {
  let app: INestApplication;
  let testPlantId: string;

  // Test data setup
  const testPlant: IPlant = {
    id: 'test-plant-1',
    type: PLANT_TYPES.TOMATOES,
    growthStage: GROWTH_STAGES.SEEDLING,
    sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
    spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
    daysToMaturity: 80,
    plantedDate: new Date(),
    lastWateredDate: new Date(),
    lastFertilizedDate: new Date(),
    companionPlants: [PLANT_TYPES.LETTUCE],
    waterRequirementMl: 500,
    expectedYieldKg: 4.5
  };

  const environmentalFactors = {
    temperature: 25,
    humidity: 60,
    rainfall: 0,
    windSpeed: 5
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlantController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Plant Creation and Validation', () => {
    it('should create a new plant with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/plants')
        .send(testPlant)
        .expect(201);

      testPlantId = response.body.id;
      expect(response.body).toMatchObject({
        ...testPlant,
        plantedDate: expect.any(String),
        lastWateredDate: expect.any(String),
        lastFertilizedDate: expect.any(String)
      });
    });

    it('should reject plant creation with invalid spacing', async () => {
      const invalidPlant = {
        ...testPlant,
        spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES] - 10
      };

      await request(app.getHttpServer())
        .post('/plants')
        .send(invalidPlant)
        .expect(400);
    });

    it('should validate companion planting compatibility', async () => {
      const incompatiblePlant = {
        ...testPlant,
        id: 'test-plant-2',
        companionPlants: [PLANT_TYPES.CARROTS] // Not a companion for tomatoes
      };

      await request(app.getHttpServer())
        .post('/plants')
        .send(incompatiblePlant)
        .expect(400);
    });
  });

  describe('Plant Retrieval and Updates', () => {
    it('should retrieve plant by ID with environmental data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/plants/${testPlantId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        ...testPlant,
        environmentalFactors: expect.any(Object),
        soilConditions: expect.any(Object)
      });
    });

    it('should update plant growth stage based on environmental factors', async () => {
      const response = await request(app.getHttpServer())
        .put(`/plants/${testPlantId}/growth-stage`)
        .send(environmentalFactors)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testPlantId,
        growthStage: expect.any(String)
      });
    });

    it('should calculate next care date considering environmental factors', async () => {
      const response = await request(app.getHttpServer())
        .get(`/plants/${testPlantId}/next-care`)
        .query({ careType: 'watering' })
        .expect(200);

      expect(response.body).toHaveProperty('nextCareDate');
      expect(new Date(response.body.nextCareDate)).toBeInstanceOf(Date);
    });
  });

  describe('Environmental Factor Validation', () => {
    it('should validate environmental factors for optimal growth', async () => {
      const response = await request(app.getHttpServer())
        .post('/plants/validate-environment')
        .send({
          plantId: testPlantId,
          environmentalFactors,
          soilConditions: {
            moisture: 0.6,
            pH: 6.5,
            nutrients: {
              nitrogen: 0.5,
              phosphorus: 0.5,
              potassium: 0.5
            }
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        isOptimal: expect.any(Boolean),
        recommendations: expect.any(Array)
      });
    });

    it('should adjust care schedule based on environmental conditions', async () => {
      const response = await request(app.getHttpServer())
        .put(`/plants/${testPlantId}/care-schedule`)
        .send({
          environmentalFactors,
          wateringFrequencyDays: 3,
          fertilizingFrequencyDays: 14,
          minSunlightHours: 6
        })
        .expect(200);

      expect(response.body).toMatchObject({
        nextWateringDate: expect.any(String),
        nextFertilizingDate: expect.any(String),
        adjustedSchedule: expect.any(Object)
      });
    });
  });

  describe('Space Optimization', () => {
    it('should validate plant spacing in garden zone', async () => {
      const response = await request(app.getHttpServer())
        .post('/plants/validate-spacing')
        .send({
          plantId: testPlantId,
          zoneId: 'zone-1',
          proposedLocation: { x: 0, y: 0 }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        isValid: expect.any(Boolean),
        conflicts: expect.any(Array)
      });
    });

    it('should suggest optimal placement considering companion plants', async () => {
      const response = await request(app.getHttpServer())
        .post('/plants/suggest-placement')
        .send({
          plantId: testPlantId,
          zoneId: 'zone-1'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        suggestedLocation: expect.any(Object),
        companionBenefits: expect.any(Array)
      });
    });
  });

  describe('Plant Deletion', () => {
    it('should delete plant and update related environmental calculations', async () => {
      await request(app.getHttpServer())
        .delete(`/plants/${testPlantId}`)
        .expect(200);

      // Verify plant is deleted
      await request(app.getHttpServer())
        .get(`/plants/${testPlantId}`)
        .expect(404);
    });
  });
});