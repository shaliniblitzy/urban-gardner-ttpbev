import { Test } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from 'jest';
import { SunlightAnalyzerService } from '../../../../src/services/optimization/sunlight-analyzer.service';
import { SUNLIGHT_CONDITIONS, SUNLIGHT_HOURS } from '../../../../src/constants/garden.constants';
import { IGarden, IGardenZone } from '../../../../src/interfaces/garden.interface';
import { IPlant } from '../../../../src/interfaces/plant.interface';
import { PLANT_TYPES } from '../../../../src/constants/plant.constants';

describe('SunlightAnalyzerService', () => {
    let service: SunlightAnalyzerService;

    // Helper function to create test garden
    const createTestGarden = (zones: IGardenZone[]): IGarden => {
        return {
            id: 'test-garden-1',
            area: zones.reduce((total, zone) => total + zone.area, 0),
            zones,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    };

    // Helper function to create test plants
    const createTestPlants = (count: number): IPlant[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `plant-${i}`,
            type: PLANT_TYPES.TOMATOES,
            growthStage: 'seedling',
            sunlightNeeds: i % 3 === 0 ? SUNLIGHT_CONDITIONS.FULL_SUN :
                          i % 3 === 1 ? SUNLIGHT_CONDITIONS.PARTIAL_SHADE :
                          SUNLIGHT_CONDITIONS.FULL_SHADE,
            spacing: 24,
            daysToMaturity: 80,
            plantedDate: new Date(),
            lastWateredDate: new Date(),
            lastFertilizedDate: new Date(),
            companionPlants: [PLANT_TYPES.LETTUCE],
            waterRequirementMl: 500,
            expectedYieldKg: 2
        }));
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [SunlightAnalyzerService],
        }).compile();

        service = moduleRef.get<SunlightAnalyzerService>(SunlightAnalyzerService);
    });

    describe('analyzeSunlightDistribution', () => {
        it('should validate a garden with proper sunlight distribution', async () => {
            const garden = createTestGarden([
                {
                    id: 'zone-1',
                    area: 50,
                    sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                    plants: []
                },
                {
                    id: 'zone-2',
                    area: 50,
                    sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE,
                    plants: []
                }
            ]);

            const result = await service.analyzeSunlightDistribution(garden);
            expect(result.isValid).toBe(true);
            expect(result.recommendations).toBeUndefined();
        });

        it('should detect missing full sun zone', async () => {
            const garden = createTestGarden([
                {
                    id: 'zone-1',
                    area: 100,
                    sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE,
                    plants: []
                }
            ]);

            const result = await service.analyzeSunlightDistribution(garden);
            expect(result.isValid).toBe(true);
            expect(result.recommendations).toContain(
                'Garden layout should include at least one full sun zone for optimal plant growth'
            );
        });

        it('should validate area consistency', async () => {
            const garden = createTestGarden([
                {
                    id: 'zone-1',
                    area: 60,
                    sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                    plants: []
                }
            ]);
            garden.area = 100; // Intentional mismatch

            const result = await service.analyzeSunlightDistribution(garden);
            expect(result.recommendations).toContain('Total zone area does not match garden area');
        });

        it('should handle empty garden zones', async () => {
            const garden = createTestGarden([]);
            const result = await service.analyzeSunlightDistribution(garden);
            expect(result.isValid).toBe(false);
            expect(result.recommendations).toContain('Garden must have at least one defined zone');
        });
    });

    describe('validateZoneSunlight', () => {
        it('should validate correct sunlight conditions', () => {
            const zone: IGardenZone = {
                id: 'zone-1',
                area: 50,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: []
            };

            expect(service.validateZoneSunlight(zone)).toBe(true);
        });

        it('should reject invalid sunlight conditions', () => {
            const zone: IGardenZone = {
                id: 'zone-1',
                area: 50,
                sunlightCondition: 'INVALID_CONDITION' as any,
                plants: []
            };

            expect(service.validateZoneSunlight(zone)).toBe(false);
        });

        it('should reject zones with zero or negative area', () => {
            const zone: IGardenZone = {
                id: 'zone-1',
                area: 0,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: []
            };

            expect(service.validateZoneSunlight(zone)).toBe(false);
        });
    });

    describe('calculateOptimalPlantPlacement', () => {
        it('should calculate valid placement for compatible plants', async () => {
            const zone: IGardenZone = {
                id: 'zone-1',
                area: 100,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: []
            };

            const plants = createTestPlants(3);
            const placement = await service.calculateOptimalPlantPlacement(zone, plants);
            
            expect(placement.size).toBe(3);
            for (const [plantId, position] of placement) {
                expect(position).toHaveProperty('x');
                expect(position).toHaveProperty('y');
                expect(position.x).toBeGreaterThanOrEqual(0);
                expect(position.y).toBeGreaterThanOrEqual(0);
            }
        });

        it('should skip plants with incompatible sunlight needs', async () => {
            const zone: IGardenZone = {
                id: 'zone-1',
                area: 100,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SHADE,
                plants: []
            };

            const plants = createTestPlants(3).map(p => ({
                ...p,
                sunlightNeeds: SUNLIGHT_CONDITIONS.FULL_SUN
            }));

            const placement = await service.calculateOptimalPlantPlacement(zone, plants);
            expect(placement.size).toBe(0);
        });

        it('should handle zone capacity limits', async () => {
            const zone: IGardenZone = {
                id: 'zone-1',
                area: 4, // Small area
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: []
            };

            const plants = createTestPlants(10); // More plants than can fit
            const placement = await service.calculateOptimalPlantPlacement(zone, plants);
            
            // Verify some plants were placed but not all
            expect(placement.size).toBeGreaterThan(0);
            expect(placement.size).toBeLessThan(10);
        });

        it('should prioritize plants with higher sunlight needs', async () => {
            const zone: IGardenZone = {
                id: 'zone-1',
                area: 100,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: []
            };

            const plants = [
                { ...createTestPlants(1)[0], sunlightNeeds: SUNLIGHT_CONDITIONS.PARTIAL_SHADE },
                { ...createTestPlants(1)[0], sunlightNeeds: SUNLIGHT_CONDITIONS.FULL_SUN }
            ];

            const placement = await service.calculateOptimalPlantPlacement(zone, plants);
            const positions = Array.from(placement.values());
            
            // Full sun plant should be placed first (closer to 0,0)
            expect(positions[0].x + positions[0].y).toBeLessThan(positions[1].x + positions[1].y);
        });
    });
});