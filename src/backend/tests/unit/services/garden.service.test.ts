import { describe, it, expect, beforeEach, jest } from 'jest';
import { GardenService } from '../../src/services/garden.service';
import { GardenRepository } from '../../src/repositories/garden.repository';
import { GardenOptimizerService } from '../../src/services/optimization/garden-optimizer.service';
import { IGarden } from '../../src/interfaces/garden.interface';

// Constants for testing
const AREA_CONSTRAINTS = {
    MIN: 1,
    MAX: 1000
};

const OPTIMIZATION_THRESHOLDS = {
    MIN_IMPROVEMENT: 30,
    TIMEOUT_MS: 3000
};

// Mock data
const mockGarden: IGarden = {
    id: 'test-garden-1',
    area: 100,
    zones: [
        {
            id: 'zone-1',
            area: 60,
            sunlightCondition: 'FULL_SUN',
            plants: [
                {
                    id: 'plant-1',
                    type: 'tomatoes',
                    spacing: 24,
                    sunlightNeeds: 'FULL_SUN'
                }
            ]
        },
        {
            id: 'zone-2',
            area: 40,
            sunlightCondition: 'PARTIAL_SHADE',
            plants: [
                {
                    id: 'plant-2',
                    type: 'lettuce',
                    spacing: 12,
                    sunlightNeeds: 'PARTIAL_SHADE'
                }
            ]
        }
    ],
    spaceUtilization: 85,
    optimizationMetrics: {
        averageExecutionTime: 1500,
        successRate: 100,
        utilizationImprovement: 35,
        totalOptimizations: 1
    }
};

describe('GardenService', () => {
    let gardenService: GardenService;
    let mockGardenRepository: jest.Mocked<GardenRepository>;
    let mockGardenOptimizer: jest.Mocked<GardenOptimizerService>;

    beforeEach(() => {
        // Initialize mocks with performance monitoring
        mockGardenRepository = {
            createGarden: jest.fn(),
            getGardenById: jest.fn(),
            updateGarden: jest.fn(),
            deleteGarden: jest.fn(),
            beginTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn()
        } as any;

        mockGardenOptimizer = {
            optimizeGardenLayout: jest.fn(),
            validateOptimization: jest.fn(),
            recalculateLayout: jest.fn(),
            getOptimizationMetrics: jest.fn(),
            validateSpaceUtilization: jest.fn()
        } as any;

        gardenService = new GardenService(mockGardenRepository, mockGardenOptimizer);
    });

    describe('createGarden', () => {
        it('should successfully create a garden with valid data and optimization', async () => {
            // Setup
            const optimizedGarden = {
                ...mockGarden,
                spaceUtilization: 95
            };
            mockGardenOptimizer.optimizeGardenLayout.mockResolvedValue(optimizedGarden);
            mockGardenRepository.createGarden.mockResolvedValue(optimizedGarden);

            // Execute
            const result = await gardenService.createGarden(mockGarden);

            // Verify
            expect(result).toBeDefined();
            expect(result.spaceUtilization).toBeGreaterThanOrEqual(92);
            expect(mockGardenOptimizer.optimizeGardenLayout).toHaveBeenCalledWith(mockGarden);
            expect(mockGardenRepository.createGarden).toHaveBeenCalled();
        });

        it('should validate garden area within constraints', async () => {
            // Test minimum area
            const tooSmallGarden = { ...mockGarden, area: 0.5 };
            await expect(gardenService.createGarden(tooSmallGarden))
                .rejects.toThrow(`Garden area must be between ${AREA_CONSTRAINTS.MIN} and ${AREA_CONSTRAINTS.MAX} sq ft`);

            // Test maximum area
            const tooLargeGarden = { ...mockGarden, area: 1001 };
            await expect(gardenService.createGarden(tooLargeGarden))
                .rejects.toThrow(`Garden area must be between ${AREA_CONSTRAINTS.MIN} and ${AREA_CONSTRAINTS.MAX} sq ft`);
        });

        it('should verify optimization performance meets requirements', async () => {
            // Setup performance monitoring
            const startTime = Date.now();
            mockGardenOptimizer.optimizeGardenLayout.mockImplementation(async () => {
                const executionTime = Date.now() - startTime;
                expect(executionTime).toBeLessThan(OPTIMIZATION_THRESHOLDS.TIMEOUT_MS);
                return mockGarden;
            });

            // Execute
            await gardenService.createGarden(mockGarden);

            // Verify optimization metrics
            const metrics = gardenService.getOptimizationMetrics();
            expect(metrics.averageExecutionTime).toBeLessThan(OPTIMIZATION_THRESHOLDS.TIMEOUT_MS);
            expect(metrics.successRate).toBe(100);
        });

        it('should handle optimization failures and rollback transaction', async () => {
            // Setup
            mockGardenOptimizer.optimizeGardenLayout.mockRejectedValue(new Error('Optimization failed'));
            mockGardenRepository.rollbackTransaction.mockResolvedValue(undefined);

            // Execute and verify
            await expect(gardenService.createGarden(mockGarden))
                .rejects.toThrow('Optimization failed');
            expect(mockGardenRepository.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('optimizeExistingGarden', () => {
        it('should successfully optimize an existing garden', async () => {
            // Setup
            const existingGarden = { ...mockGarden, spaceUtilization: 70 };
            const optimizedGarden = { ...mockGarden, spaceUtilization: 95 };
            
            mockGardenRepository.getGardenById.mockResolvedValue(existingGarden);
            mockGardenOptimizer.optimizeGardenLayout.mockResolvedValue(optimizedGarden);
            mockGardenRepository.updateGarden.mockResolvedValue(optimizedGarden);

            // Execute
            const result = await gardenService.optimizeExistingGarden(mockGarden.id);

            // Verify
            expect(result).toBeDefined();
            expect(result.spaceUtilization).toBeGreaterThan(existingGarden.spaceUtilization);
            expect(result.spaceUtilization).toBeGreaterThanOrEqual(92);
        });

        it('should validate space utilization improvement', async () => {
            // Setup
            const existingGarden = { ...mockGarden, spaceUtilization: 70 };
            const insufficientImprovement = { ...mockGarden, spaceUtilization: 75 };
            
            mockGardenRepository.getGardenById.mockResolvedValue(existingGarden);
            mockGardenOptimizer.optimizeGardenLayout.mockResolvedValue(insufficientImprovement);

            // Execute and verify
            await expect(gardenService.optimizeExistingGarden(mockGarden.id))
                .rejects.toThrow('Insufficient space utilization improvement');
        });

        it('should monitor optimization performance', async () => {
            // Setup performance tracking
            const startTime = Date.now();
            mockGardenOptimizer.optimizeGardenLayout.mockImplementation(async () => {
                const executionTime = Date.now() - startTime;
                expect(executionTime).toBeLessThan(OPTIMIZATION_THRESHOLDS.TIMEOUT_MS);
                return { ...mockGarden, spaceUtilization: 95 };
            });

            // Execute
            await gardenService.optimizeExistingGarden(mockGarden.id);

            // Verify metrics
            const metrics = gardenService.getOptimizationMetrics();
            expect(metrics.averageExecutionTime).toBeLessThan(OPTIMIZATION_THRESHOLDS.TIMEOUT_MS);
            expect(metrics.utilizationImprovement).toBeGreaterThanOrEqual(OPTIMIZATION_THRESHOLDS.MIN_IMPROVEMENT);
        });
    });

    describe('updateGarden', () => {
        it('should update garden with reoptimization when needed', async () => {
            // Setup
            const updateData = { area: 120 };
            const optimizedGarden = { ...mockGarden, ...updateData, spaceUtilization: 95 };
            
            mockGardenRepository.getGardenById.mockResolvedValue(mockGarden);
            mockGardenOptimizer.optimizeGardenLayout.mockResolvedValue(optimizedGarden);
            mockGardenRepository.updateGarden.mockResolvedValue(optimizedGarden);

            // Execute
            const result = await gardenService.updateGarden(mockGarden.id, updateData);

            // Verify
            expect(result).toBeDefined();
            expect(result.area).toBe(updateData.area);
            expect(result.spaceUtilization).toBeGreaterThanOrEqual(92);
            expect(mockGardenOptimizer.optimizeGardenLayout).toHaveBeenCalled();
        });

        it('should validate updated garden configuration', async () => {
            // Setup invalid update
            const invalidUpdate = { area: AREA_CONSTRAINTS.MAX + 1 };
            mockGardenRepository.getGardenById.mockResolvedValue(mockGarden);

            // Execute and verify
            await expect(gardenService.updateGarden(mockGarden.id, invalidUpdate))
                .rejects.toThrow(`Garden area must be between ${AREA_CONSTRAINTS.MIN} and ${AREA_CONSTRAINTS.MAX} sq ft`);
        });
    });

    describe('deleteGarden', () => {
        it('should successfully delete garden and clear cache', async () => {
            // Setup
            mockGardenRepository.deleteGarden.mockResolvedValue(true);

            // Execute
            const result = await gardenService.deleteGarden(mockGarden.id);

            // Verify
            expect(result).toBe(true);
            expect(mockGardenRepository.deleteGarden).toHaveBeenCalledWith(mockGarden.id);
        });

        it('should handle deletion failures', async () => {
            // Setup
            mockGardenRepository.deleteGarden.mockRejectedValue(new Error('Deletion failed'));

            // Execute and verify
            await expect(gardenService.deleteGarden(mockGarden.id))
                .rejects.toThrow('Deletion failed');
        });
    });
});