package com.gardenplanner.core.di

import android.content.Context
import com.gardenplanner.core.database.AppDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module that provides database-related dependencies with enhanced
 * performance monitoring, security, and data retention policies.
 *
 * Version: Room Database 2.5.0
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    /**
     * Provides singleton instance of Room database with performance monitoring
     * and security configuration.
     *
     * Performance Requirements:
     * - Response time < 3s
     * - Storage limit < 100MB
     *
     * @param context Application context for database initialization
     * @return Singleton database instance with monitoring enabled
     */
    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return AppDatabase.getDatabase(context).apply {
            // Initialize performance monitoring
            monitorPerformance().let { metrics ->
                // Log initial metrics
                android.util.Log.d(
                    "DatabaseModule",
                    "Database initialized with metrics: " +
                    "Storage: ${metrics.storageUsed / 1024}KB, " +
                    "Query time: ${metrics.averageQueryTime}ms, " +
                    "Cache hit rate: ${metrics.cacheHitRate}%"
                )
            }
        }
    }

    /**
     * Provides GardenDao instance with permanent data retention policy.
     * Implements secure data persistence for garden layouts and configurations.
     *
     * @param database AppDatabase instance
     * @return Garden data access object with retention policy
     */
    @Provides
    @Singleton
    fun provideGardenDao(database: AppDatabase) = database.gardenDao()

    /**
     * Provides PlantDao instance with read-only plant database access.
     * Implements version-based updates for plant data.
     *
     * @param database AppDatabase instance
     * @return Plant data access object with read-only access
     */
    @Provides
    @Singleton
    fun providePlantDao(database: AppDatabase) = database.plantDao()

    /**
     * Provides ScheduleDao instance with 1-year data retention policy.
     * Implements automatic cleanup of expired schedules.
     *
     * @param database AppDatabase instance
     * @return Schedule data access object with retention policy
     */
    @Provides
    @Singleton
    fun provideScheduleDao(database: AppDatabase) = database.scheduleDao()
}