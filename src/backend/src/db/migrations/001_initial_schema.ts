/**
 * Initial database migration for garden planner application
 * Establishes core schema with enhanced tracking and optimization features
 * @version 1.0.0
 */

import { Knex } from 'knex'; // version: 2.5.1
import { IGarden } from '../../interfaces/garden.interface';
import { IPlant } from '../../interfaces/plant.interface';
import { ISchedule } from '../../interfaces/schedule.interface';

export async function up(knex: Knex): Promise<void> {
    // Create gardens table
    await knex.schema.createTable('gardens', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.float('area').notNullable().checkPositive();
        table.float('spaceUtilization').notNullable().defaultTo(0);
        table.boolean('isActive').notNullable().defaultTo(true);
        table.boolean('seasonalAdjustments').notNullable().defaultTo(false);
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

        // Add check constraint for area limits
        table.check('?? >= 1 AND ?? <= 1000', ['area', 'area']);
        table.check('?? >= 0 AND ?? <= 100', ['spaceUtilization', 'spaceUtilization']);
    });

    // Create zones table
    await knex.schema.createTable('zones', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('gardenId').notNullable();
        table.enu('sunlightCondition', ['FULL_SUN', 'PARTIAL_SHADE', 'FULL_SHADE']).notNullable();
        table.string('microclimate').nullable();
        table.float('area').notNullable().checkPositive();
        table.float('x').notNullable();
        table.float('y').notNullable();
        table.float('width').notNullable().checkPositive();
        table.float('height').notNullable().checkPositive();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

        table.foreign('gardenId')
            .references('id')
            .inTable('gardens')
            .onDelete('CASCADE');
    });

    // Create plants table
    await knex.schema.createTable('plants', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.enu('type', ['tomatoes', 'lettuce', 'carrots']).notNullable();
        table.enu('growthStage', ['seedling', 'growing', 'mature', 'harvesting']).notNullable();
        table.float('expectedYieldKg').notNullable();
        table.jsonb('companionPlants').notNullable().defaultTo('[]');
        table.jsonb('maintenanceHistory').notNullable().defaultTo('[]');
        table.enu('sunlightNeeds', ['full_sun', 'partial_shade', 'full_shade']).notNullable();
        table.integer('spacing').notNullable();
        table.integer('daysToMaturity').notNullable();
        table.timestamp('plantedDate').notNullable();
        table.timestamp('lastWateredDate').nullable();
        table.timestamp('lastFertilizedDate').nullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
    });

    // Create schedules table
    await knex.schema.createTable('schedules', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('gardenId').notNullable();
        table.uuid('plantId').nullable();
        table.enu('taskType', [
            'watering', 'fertilizing', 'pruning', 'harvesting',
            'pest_control', 'composting', 'mulching', 'weeding'
        ]).notNullable();
        table.enu('frequency', ['daily', 'weekly', 'biweekly', 'monthly', 'as_needed']).notNullable();
        table.timestamp('dueDate').notNullable();
        table.boolean('weatherDependent').notNullable().defaultTo(false);
        table.jsonb('notificationPreferences').notNullable();
        table.jsonb('completionHistory').notNullable().defaultTo('[]');
        table.boolean('completed').notNullable().defaultTo(false);
        table.timestamp('completedDate').nullable();
        table.integer('priority').notNullable().defaultTo(2);
        table.text('notes').nullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

        table.foreign('gardenId')
            .references('id')
            .inTable('gardens')
            .onDelete('CASCADE');
        table.foreign('plantId')
            .references('id')
            .inTable('plants')
            .onDelete('SET NULL');
    });

    // Create garden_plants junction table
    await knex.schema.createTable('garden_plants', (table) => {
        table.uuid('gardenId').notNullable();
        table.uuid('plantId').notNullable();
        table.integer('quantity').notNullable().checkPositive();
        table.float('spacing').notNullable().checkPositive();
        table.float('expectedYield').notNullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

        table.primary(['gardenId', 'plantId']);
        table.foreign('gardenId')
            .references('id')
            .inTable('gardens')
            .onDelete('CASCADE');
        table.foreign('plantId')
            .references('id')
            .inTable('plants')
            .onDelete('CASCADE');
    });

    // Create indices for performance optimization
    await knex.schema.alterTable('gardens', (table) => {
        table.index('isActive');
        table.index('spaceUtilization');
    });

    await knex.schema.alterTable('zones', (table) => {
        table.index(['gardenId', 'sunlightCondition']);
    });

    await knex.schema.alterTable('plants', (table) => {
        table.index(['type', 'growthStage']);
    });

    await knex.schema.alterTable('schedules', (table) => {
        table.index(['gardenId', 'dueDate']);
        table.index(['plantId', 'taskType']);
        table.index('completed');
    });
}

export async function down(knex: Knex): Promise<void> {
    // Drop tables in reverse order to maintain referential integrity
    await knex.schema.dropTableIfExists('garden_plants');
    await knex.schema.dropTableIfExists('schedules');
    await knex.schema.dropTableIfExists('plants');
    await knex.schema.dropTableIfExists('zones');
    await knex.schema.dropTableIfExists('gardens');
}