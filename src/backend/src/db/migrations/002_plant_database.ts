import { Knex } from 'knex'; // v2.5.1
import { PLANT_TYPES, GROWTH_STAGES, SUNLIGHT_REQUIREMENTS } from '../../constants/plant.constants';
import { IPlant } from '../../interfaces/plant.interface';

/**
 * Implements comprehensive plant database schema with growth tracking,
 * care requirements, companion planting relationships, and performance optimizations
 */
export async function up(knex: Knex): Promise<void> {
    // Create plant_details table with versioned data and core attributes
    await knex.schema.createTable('plant_details', (table) => {
        table.uuid('id').primary();
        table.enum('type', Object.values(PLANT_TYPES)).notNullable();
        table.integer('version').notNullable().defaultTo(1);
        table.float('defaultSpacing').notNullable().checkPositive();
        table.integer('daysToMaturity').notNullable().checkPositive();
        table.integer('wateringFrequencyDays').notNullable().checkPositive();
        table.integer('fertilizingFrequencyDays').notNullable().checkPositive();
        table.integer('minSunlightHours').notNullable()
            .checkBetween([1, 24]);
        table.float('expectedYieldKg').notNullable().checkPositive();
        table.float('waterRequirementMl').notNullable().checkPositive();
        table.timestamps(true, true);

        // Add optimized index for frequent plant type queries
        table.index(['type'], 'plant_details_type_idx');
    });

    // Create plant_growth_tracking table for monitoring plant progress
    await knex.schema.createTable('plant_growth_tracking', (table) => {
        table.uuid('id').primary();
        table.uuid('plantId').notNullable();
        table.enum('currentStage', Object.values(GROWTH_STAGES)).notNullable();
        table.integer('daysInStage').notNullable().defaultTo(0);
        table.date('expectedHarvestDate').notNullable();
        table.float('actualGrowthRate').nullable();
        table.string('healthStatus').notNullable();
        table.timestamp('lastUpdated').notNullable();

        // Foreign key constraint with cascade delete
        table.foreign('plantId')
            .references('id')
            .inTable('plant_details')
            .onDelete('CASCADE');

        // Composite index for efficient growth tracking queries
        table.index(['plantId', 'currentStage'], 'growth_tracking_plant_idx');
    });

    // Create companion_plants table for plant relationship mapping
    await knex.schema.createTable('companion_plants', (table) => {
        table.uuid('plantId').notNullable();
        table.uuid('companionPlantId').notNullable();
        table.enum('relationshipType', ['BENEFICIAL', 'NEUTRAL', 'HARMFUL']).notNullable();
        table.string('benefitDescription').nullable();
        table.timestamps(true, true);

        // Composite primary key
        table.primary(['plantId', 'companionPlantId']);

        // Foreign key constraints
        table.foreign('plantId')
            .references('id')
            .inTable('plant_details')
            .onDelete('CASCADE');
        table.foreign('companionPlantId')
            .references('id')
            .inTable('plant_details')
            .onDelete('CASCADE');

        // Index for companion plant lookups
        table.index(['plantId'], 'companion_plant_lookup_idx');
    });

    // Create plant_care_schedule table for maintenance tracking
    await knex.schema.createTable('plant_care_schedule', (table) => {
        table.uuid('id').primary();
        table.uuid('plantId').notNullable();
        table.enum('taskType', ['WATER', 'FERTILIZE', 'PRUNE', 'HARVEST']).notNullable();
        table.integer('frequencyDays').notNullable();
        table.date('lastPerformedDate').nullable();
        table.date('nextDueDate').notNullable();
        table.string('notes').nullable();

        // Foreign key constraint
        table.foreign('plantId')
            .references('id')
            .inTable('plant_details')
            .onDelete('CASCADE');

        // Composite index for efficient schedule queries
        table.index(['plantId', 'nextDueDate'], 'care_schedule_date_idx');
    });

    // Add sunlight requirements table for garden zone planning
    await knex.schema.createTable('plant_sunlight_needs', (table) => {
        table.uuid('plantId').primary();
        table.enum('requirement', Object.values(SUNLIGHT_REQUIREMENTS)).notNullable();
        table.integer('optimalHours').notNullable()
            .checkBetween([1, 24]);
        table.integer('minimumHours').notNullable()
            .checkBetween([1, 24]);
        
        table.foreign('plantId')
            .references('id')
            .inTable('plant_details')
            .onDelete('CASCADE');
    });

    // Create performance optimization views
    await knex.raw(`
        CREATE VIEW plant_maintenance_view AS
        SELECT 
            pd.id,
            pd.type,
            pgt.currentStage,
            pcs.nextDueDate,
            pcs.taskType
        FROM plant_details pd
        JOIN plant_growth_tracking pgt ON pd.id = pgt.plantId
        JOIN plant_care_schedule pcs ON pd.id = pcs.plantId
        WHERE pcs.nextDueDate <= CURRENT_DATE
    `);
}

/**
 * Rolls back plant database schema extensions with proper cleanup
 */
export async function down(knex: Knex): Promise<void> {
    // Drop views first
    await knex.raw('DROP VIEW IF EXISTS plant_maintenance_view');

    // Drop tables in reverse order of creation
    await knex.schema.dropTableIfExists('plant_sunlight_needs');
    await knex.schema.dropTableIfExists('plant_care_schedule');
    await knex.schema.dropTableIfExists('companion_plants');
    await knex.schema.dropTableIfExists('plant_growth_tracking');
    await knex.schema.dropTableIfExists('plant_details');
}