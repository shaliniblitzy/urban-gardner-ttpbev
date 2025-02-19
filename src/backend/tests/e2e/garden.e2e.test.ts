/**
 * Garden Management API End-to-End Tests
 * @packageVersion 5.0
 * 
 * Comprehensive test suite validating garden management functionality including:
 * - Garden creation and validation (F-001-RQ-001)
 * - Space optimization algorithm (F-001)
 * - Sunlight condition validation (F-001-RQ-002)
 * - Space utilization metrics (30% improvement target)
 */

import { describe, it, beforeAll, afterAll, expect } from 'jest';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest'; // ^6.0.0
import { Test } from '@nestjs/testing';

import { IGarden, IGardenZone, IGardenLayout } from '../../src/interfaces/garden.interface';
import { GARDEN_AREA_LIMITS, SUNLIGHT_CONDITIONS } from '../../src/constants/garden.constants';
import { AppModule } from '../../src/app.module';

describe('Garden Management API (e2e)', () => {
  let app: INestApplication;
  let testGardenId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /gardens', () => {
    it('should create a garden with valid parameters', async () => {
      const validGarden = {
        area: 500,
        zones: [
          {
            area: 300,
            sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN
          },
          {
            area: 200,
            sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE
          }
        ]
      };

      const response = await request(app.getHttpServer())
        .post('/gardens')
        .send(validGarden)
        .expect(201);

      testGardenId = response.body.id;
      expect(response.body).toMatchObject({
        id: expect.any(String),
        area: validGarden.area,
        zones: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            area: validGarden.zones[0].area,
            sunlightCondition: validGarden.zones[0].sunlightCondition
          })
        ]),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('should reject garden creation with invalid area', async () => {
      const invalidGarden = {
        area: GARDEN_AREA_LIMITS.MAX_AREA + 1,
        zones: []
      };

      await request(app.getHttpServer())
        .post('/gardens')
        .send(invalidGarden)
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain('Garden area must be between');
        });
    });

    it('should validate zone areas sum matches total garden area', async () => {
      const invalidZones = {
        area: 500,
        zones: [
          { area: 300, sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN },
          { area: 300, sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE }
        ]
      };

      await request(app.getHttpServer())
        .post('/gardens')
        .send(invalidZones)
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain('Zone areas must sum to total garden area');
        });
    });
  });

  describe('POST /gardens/:id/optimize', () => {
    it('should optimize garden layout and improve space utilization', async () => {
      const initialLayout = await request(app.getHttpServer())
        .get(`/gardens/${testGardenId}/layout`)
        .expect(200);

      const optimizedResponse = await request(app.getHttpServer())
        .post(`/gardens/${testGardenId}/optimize`)
        .expect(200);

      const layout: IGardenLayout = optimizedResponse.body;
      
      // Verify 30% improvement in space utilization
      expect(layout.spaceUtilization).toBeGreaterThan(
        initialLayout.body.spaceUtilization * 1.3
      );

      // Verify optimization completed within 3 seconds
      expect(
        new Date(layout.generatedAt).getTime() - 
        new Date(initialLayout.body.generatedAt).getTime()
      ).toBeLessThan(3000);
    });

    it('should maintain valid zone configurations after optimization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/gardens/${testGardenId}`)
        .expect(200);

      const garden: IGarden = response.body;
      
      // Validate zone areas still sum to total garden area
      const totalZoneArea = garden.zones.reduce((sum, zone) => sum + zone.area, 0);
      expect(totalZoneArea).toBe(garden.area);

      // Validate each zone maintains proper sunlight conditions
      garden.zones.forEach(zone => {
        expect(Object.values(SUNLIGHT_CONDITIONS)).toContain(zone.sunlightCondition);
      });
    });

    it('should handle optimization for minimum garden size', async () => {
      const minGarden = {
        area: GARDEN_AREA_LIMITS.MIN_AREA,
        zones: [{
          area: GARDEN_AREA_LIMITS.MIN_AREA,
          sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN
        }]
      };

      const createResponse = await request(app.getHttpServer())
        .post('/gardens')
        .send(minGarden)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/gardens/${createResponse.body.id}/optimize`)
        .expect(200)
        .expect(res => {
          expect(res.body.spaceUtilization).toBeGreaterThan(0);
          expect(res.body.zones).toHaveLength(1);
        });
    });

    it('should handle optimization for maximum garden size', async () => {
      const maxGarden = {
        area: GARDEN_AREA_LIMITS.MAX_AREA,
        zones: [{
          area: GARDEN_AREA_LIMITS.MAX_AREA,
          sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN
        }]
      };

      const createResponse = await request(app.getHttpServer())
        .post('/gardens')
        .send(maxGarden)
        .expect(201);

      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .post(`/gardens/${createResponse.body.id}/optimize`)
        .expect(200)
        .expect(res => {
          expect(Date.now() - startTime).toBeLessThan(3000); // Performance requirement
          expect(res.body.spaceUtilization).toBeGreaterThan(0);
        });
    });
  });

  describe('GET /gardens/:id', () => {
    it('should retrieve garden with all zones and metrics', async () => {
      await request(app.getHttpServer())
        .get(`/gardens/${testGardenId}`)
        .expect(200)
        .expect(res => {
          expect(res.body).toMatchObject({
            id: testGardenId,
            area: expect.any(Number),
            zones: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(String),
                area: expect.any(Number),
                sunlightCondition: expect.any(String),
                plants: expect.any(Array)
              })
            ]),
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          });
        });
    });

    it('should return 404 for non-existent garden', async () => {
      await request(app.getHttpServer())
        .get('/gardens/non-existent-id')
        .expect(404);
    });
  });
});