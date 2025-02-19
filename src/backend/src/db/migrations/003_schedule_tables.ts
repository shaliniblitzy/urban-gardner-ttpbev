import { Knex } from 'knex'; // v2.5.1
import { TaskType, TaskPriority } from '../../interfaces/schedule.interface';
import { NotificationType } from '../../interfaces/notification.interface';

export async function up(knex: Knex): Promise<void> {
    // Create maintenance_schedules table
    await knex.schema.createTable('maintenance_schedules', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('garden_id').notNullable().references('id').inTable('gardens').onDelete('CASCADE');
        table.uuid('plant_id').notNullable().references('id').inTable('plants').onDelete('CASCADE');
        table.enum('task_type', Object.values(TaskType)).notNullable();
        table.timestamp('due_date').notNullable();
        table.boolean('completed').defaultTo(false);
        table.timestamp('completed_date').nullable();
        table.enum('notification_type', Object.values(NotificationType)).notNullable();
        table.enum('priority', Object.values(TaskPriority)).notNullable().defaultTo('MEDIUM');
        table.boolean('weather_dependent').defaultTo(false);
        table.text('completion_notes').nullable();
        table.integer('retry_count').defaultTo(0);
        table.jsonb('task_metadata').defaultTo('{}');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        // Indexes for optimized querying
        table.index(['garden_id', 'due_date']);
        table.index(['completed', 'due_date']);
        table.index(['priority', 'due_date']);
    });

    // Create schedule_preferences table
    await knex.schema.createTable('schedule_preferences', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('garden_id').notNullable().references('id').inTable('gardens').onDelete('CASCADE');
        table.time('preferred_time').notNullable().defaultTo('09:00');
        table.boolean('notification_enabled').notNullable().defaultTo(true);
        table.integer('reminder_interval').notNullable().defaultTo(24); // hours
        table.integer('max_reminders').notNullable().defaultTo(3);
        table.string('timezone').notNullable().defaultTo('UTC');
        table.time('quiet_hours_start').notNullable().defaultTo('22:00');
        table.time('quiet_hours_end').notNullable().defaultTo('07:00');
        table.integer('max_daily_notifications').notNullable().defaultTo(5);
        table.jsonb('notification_channels').notNullable().defaultTo(JSON.stringify(['PUSH', 'EMAIL']));
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        // Indexes for preference lookups
        table.index(['garden_id', 'notification_enabled']);
        table.unique(['garden_id']);
    });

    // Create schedule_statistics table
    await knex.schema.createTable('schedule_statistics', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('garden_id').notNullable().references('id').inTable('gardens').onDelete('CASCADE');
        table.integer('total_tasks').notNullable().defaultTo(0);
        table.integer('completed_tasks').notNullable().defaultTo(0);
        table.integer('upcoming_tasks').notNullable().defaultTo(0);
        table.decimal('completion_rate', 5, 2).notNullable().defaultTo(0);
        table.jsonb('monthly_completion_rate').notNullable().defaultTo('{}');
        table.integer('average_completion_time').notNullable().defaultTo(0); // minutes
        table.integer('missed_task_count').notNullable().defaultTo(0);
        table.timestamp('last_calculated_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        // Index for statistics lookups
        table.unique(['garden_id']);
    });

    // Create triggers for automatic timestamp updates
    await knex.raw(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    `);

    // Add update triggers to all tables
    const tables = ['maintenance_schedules', 'schedule_preferences', 'schedule_statistics'];
    for (const table of tables) {
        await knex.raw(`
            CREATE TRIGGER update_${table}_updated_at
                BEFORE UPDATE ON ${table}
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);
    }
}

export async function down(knex: Knex): Promise<void> {
    // Drop triggers first
    const tables = ['maintenance_schedules', 'schedule_preferences', 'schedule_statistics'];
    for (const table of tables) {
        await knex.raw(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
    }

    // Drop function
    await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column()');

    // Drop tables in reverse order to handle dependencies
    await knex.schema.dropTableIfExists('schedule_statistics');
    await knex.schema.dropTableIfExists('schedule_preferences');
    await knex.schema.dropTableIfExists('maintenance_schedules');
}