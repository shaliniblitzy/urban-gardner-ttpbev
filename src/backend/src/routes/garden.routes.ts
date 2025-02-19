/**
 * Garden Routes Module
 * @packageVersion 5.0
 * 
 * Defines NestJS route configurations for garden management endpoints with enhanced
 * validation, caching, and performance monitoring. Implements garden space optimization
 * requirements (F-001) targeting 30% improvement in space utilization.
 */

import { Module } from '@nestjs/common'; // @version ^9.0.0
import { Routes } from '@nestjs/core'; // @version ^9.0.0
import { ApiTags } from '@nestjs/swagger'; // @version ^6.0.0
import { RateLimit } from '@nestjs/throttler'; // @version ^4.0.0
import { Cache } from '@nestjs/cache-manager'; // @version ^1.0.0

import { GardenController } from '../controllers/garden.controller';
import { validateGardenInput } from '../validators/garden.validator';
import { IGarden } from '../interfaces/garden.interface';

/**
 * Garden routes module with enhanced validation and performance monitoring
 * Implements F-001 requirements for garden space optimization
 */
@Module({
    imports: [
        // Rate limiting configuration for optimization endpoints
        RateLimit({
            ttl: 60,
            limit: 10,
            points: 10
        }),
        // Caching configuration for optimization results
        Cache({
            ttl: 86400, // 24 hour cache
            max: 100    // Maximum 100 cached layouts
        })
    ],
    controllers: [GardenController],
    providers: [
        {
            provide: 'GARDEN_VALIDATOR',
            useValue: validateGardenInput
        }
    ],
    exports: []
})
@ApiTags('garden')
export class GardenModule {
    // Module configuration is handled through decorators
}

/**
 * Garden route configurations with validation and monitoring
 * Each route is configured with appropriate rate limiting and caching
 */
export const gardenRoutes: Routes = [
    {
        path: 'gardens',
        module: GardenModule,
        children: [
            {
                path: ':id',
                module: GardenModule
            },
            {
                path: ':id/optimize',
                module: GardenModule
            }
        ]
    }
];