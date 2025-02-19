/**
 * Integration Tests for Garden Management
 * @packageVersion 5.0
 * 
 * Tests the complete flow of garden management operations including creation,
 * optimization, and maintenance. Verifies core requirements for space optimization
 * and area validation.
 */

import { Test, TestingModule } from '@nestjs/testing'; // @version ^9.0.0
import { describe, it, beforeEach, afterEach, expect } from 'jest'; // @version ^29.0.0
import { GardenService } from '../../src/services/garden.service';
import { IGarden } from '../../src/interfaces/garden.interface';
import { GARDEN_AREA_LIMITS } from '../../src/constants/garden.constants';
import { SUNLIGHT_CONDITIONS } from '../../src/constants/garden.constants';
import { PLANT_TYPES } from '../../src/constants/plant.constants';

describe('Garden Management Integration Tests', () => {
    let module: TestingModule;
    let gardenService: GardenService;

    beforeEach(async () => {
        // Create testing module with mocked dependencies
        module = await Test.createTestingModule({
            providers: [
                GardenService,
                {
                    provide: 'GardenRepository',
                    useValue: {
                        createGarden: jest.fn(),
                        getGardenById: jest.fn(),
                        updateGarden: jest.fn(),
                        deleteGarden: jest.fn()
                    }
                },
                {
                    provide: 'GardenOptimizerService',
                    useValue: {
                        optimizeGardenLayout: jest.fn()
                    }
                }
            ]
        }).compile();

        gardenService = module.get<GardenService>(GardenService);
    });

    afterEach(async () => {
        await module.close();
        jest.clearAllMocks();
    });

    // Test fixture for valid garden data
    const createValidGardenFixture = (): IGarden => ({
        id: 'test-garden-1',
        area: 100, // sq ft
        zones: [
            {
                id: 'zone-1',
                area: 60,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: [
                    {
                        id: 'plant-1',
                        type: PLANT_TYPES.TOMATOES,
                        spacing: 24,
                        sunlightNeeds: SUNLIGHT_CONDITIONS.FULL_SUN
                    }
                ]
            },
            {
                id: 'zone-2',
                area: 40,
                sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE,
                plants: [
                    {
                        id: 'plant-2',
                        type: PLANT_TYPES.LETTUCE,
                        spacing: 12,
                        sunlightNeeds: SUNLIGHT_CONDITIONS.PARTIAL_SHADE
                    }
                ]
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    });

    describe('Garden Creation', () => {
        it('should create garden with valid data', async () => {
            const gardenData = createValidGardenFixture();
            const result = await gardenService.createGarden(gardenData);

            expect(result).toBeDefined();
            expect(result.id).toBe(gardenData.id);
            expect(result.area).toBe(gardenData.area);
            expect(result.zones.length).toBe(gardenData.zones.length);
        });

        it('should reject garden with invalid area', async () => {
            const invalidGarden = createValidGardenFixture();
            invalidGarden.area = GARDEN_AREA_LIMITS.MAX_AREA + 1;

            await expect(gardenService.createGarden(invalidGarden))
                .rejects
                .toThrow(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`);
        });

        it('should optimize garden layout on creation', async () => {
            const gardenData = createValidGardenFixture();
            const result = await gardenService.createGarden(gardenData);

            expect(result.zones).toBeDefined();
            expect(result.zones.every(zone => zone.plants.length > 0)).toBe(true);
        });

        it('should achieve minimum 30% space utilization', async () => {
            const gardenData = createValidGardenFixture();
            const result = await gardenService.createGarden(gardenData);

            const utilization = result.zones.reduce((sum, zone) => 
                sum + (zone.area * (zone.plants.length > 0 ? 1 : 0)), 0) / result.area * 100;

            expect(utilization).toBeGreaterThanOrEqual(30);
        });
    });

    describe('Garden Retrieval', () => {
        it('should retrieve existing garden by ID', async () => {
            const gardenData = createValidGardenFixture();
            await gardenService.createGarden(gardenData);

            const result = await gardenService.getGardenById(gardenData.id);
            expect(result).toBeDefined();
            expect(result.id).toBe(gardenData.id);
        });

        it('should return null for non-existent garden', async () => {
            await expect(gardenService.getGardenById('non-existent'))
                .rejects
                .toThrow('Garden with ID non-existent not found');
        });

        it('should retrieve garden with all zones', async () => {
            const gardenData = createValidGardenFixture();
            const created = await gardenService.createGarden(gardenData);
            const retrieved = await gardenService.getGardenById(created.id);

            expect(retrieved.zones).toHaveLength(gardenData.zones.length);
            expect(retrieved.zones[0].plants).toBeDefined();
        });
    });

    describe('Garden Updates', () => {
        it('should update garden area and recalculate layout', async () => {
            const gardenData = createValidGardenFixture();
            const created = await gardenService.createGarden(gardenData);

            const updatedArea = 150;
            const result = await gardenService.updateGarden(created.id, { area: updatedArea });

            expect(result.area).toBe(updatedArea);
            expect(result.zones.reduce((sum, zone) => sum + zone.area, 0))
                .toBeCloseTo(updatedArea, 1);
        });

        it('should update zones and maintain optimization', async () => {
            const gardenData = createValidGardenFixture();
            const created = await gardenService.createGarden(gardenData);

            const newZone = {
                id: 'zone-3',
                area: 30,
                sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE,
                plants: []
            };

            const result = await gardenService.updateGarden(created.id, {
                zones: [...created.zones, newZone]
            });

            expect(result.zones).toHaveLength(created.zones.length + 1);
            expect(result.zones.find(z => z.id === newZone.id)).toBeDefined();
        });

        it('should reject invalid updates', async () => {
            const gardenData = createValidGardenFixture();
            const created = await gardenService.createGarden(gardenData);

            await expect(gardenService.updateGarden(created.id, {
                area: GARDEN_AREA_LIMITS.MAX_AREA + 1
            })).rejects.toThrow();
        });
    });

    describe('Garden Deletion', () => {
        it('should delete existing garden', async () => {
            const gardenData = createValidGardenFixture();
            const created = await gardenService.createGarden(gardenData);

            const result = await gardenService.deleteGarden(created.id);
            expect(result).toBe(true);

            await expect(gardenService.getGardenById(created.id))
                .rejects
                .toThrow();
        });

        it('should handle non-existent garden deletion', async () => {
            await expect(gardenService.deleteGarden('non-existent'))
                .rejects
                .toThrow('Garden with ID non-existent not found');
        });
    });

    describe('Garden Optimization', () => {
        it('should optimize existing garden layout', async () => {
            const gardenData = createValidGardenFixture();
            const created = await gardenService.createGarden(gardenData);

            // Trigger reoptimization by updating area
            const result = await gardenService.updateGarden(created.id, {
                area: created.area * 1.1 // Increase area by 10%
            });

            expect(result.zones.every(zone => 
                zone.plants.length > 0 && 
                zone.plants.every(plant => plant.spacing > 0)
            )).toBe(true);
        });

        it('should handle different sunlight conditions', async () => {
            const gardenData = createValidGardenFixture();
            gardenData.zones[0].sunlightCondition = SUNLIGHT_CONDITIONS.FULL_SHADE;

            const result = await gardenService.createGarden(gardenData);
            expect(result.zones[0].sunlightCondition).toBe(SUNLIGHT_CONDITIONS.FULL_SHADE);
            expect(result.zones[0].plants.length).toBeGreaterThan(0);
        });

        it('should optimize for multiple plant types', async () => {
            const gardenData = createValidGardenFixture();
            gardenData.zones[0].plants.push({
                id: 'plant-3',
                type: PLANT_TYPES.CARROTS,
                spacing: 3,
                sunlightNeeds: SUNLIGHT_CONDITIONS.FULL_SUN
            });

            const result = await gardenService.createGarden(gardenData);
            const plantTypes = new Set(
                result.zones.flatMap(zone => 
                    zone.plants.map(plant => plant.type)
                )
            );

            expect(plantTypes.size).toBeGreaterThan(1);
        });
    });
});