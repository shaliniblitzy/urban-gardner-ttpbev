package com.gardenplanner.core.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import com.gardenplanner.core.database.AppDatabase
import com.gardenplanner.core.database.dao.GardenDao
import com.gardenplanner.core.notifications.NotificationManager
import com.gardenplanner.data.repositories.GardenRepository
import com.gardenplanner.core.utils.Constants.DATABASE.DATABASE_NAME

/**
 * Dagger Hilt module providing application-wide dependencies with enhanced
 * performance monitoring, error handling, and offline support capabilities.
 *
 * Implements comprehensive dependency injection for:
 * - Database access with performance monitoring
 * - Enhanced notification management with offline support
 * - Optimized repository layer with error recovery
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    /**
     * Provides singleton instance of AppDatabase with performance monitoring
     * and automatic cleanup capabilities.
     *
     * @param context Application context
     * @return AppDatabase instance with performance monitoring enabled
     */
    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return AppDatabase.getDatabase(context).apply {
            // Initialize performance monitoring
            monitorPerformance().let { metrics ->
                // Log initial metrics if needed
            }
        }
    }

    /**
     * Provides GardenDao instance with enhanced error handling
     * and query optimization.
     *
     * @param database AppDatabase instance
     * @return GardenDao with error handling capabilities
     */
    @Provides
    fun provideGardenDao(database: AppDatabase): GardenDao {
        return database.gardenDao()
    }

    /**
     * Provides singleton instance of GardenRepository with enhanced
     * error handling and storage optimization.
     *
     * @param gardenDao GardenDao instance
     * @return GardenRepository with error recovery capabilities
     */
    @Provides
    @Singleton
    fun provideGardenRepository(
        gardenDao: GardenDao
    ): GardenRepository {
        return GardenRepository(gardenDao)
    }

    /**
     * Provides singleton instance of NotificationManager with
     * offline support and enhanced delivery guarantees.
     *
     * @param context Application context
     * @return NotificationManager with offline capabilities
     */
    @Provides
    @Singleton
    fun provideNotificationManager(
        @ApplicationContext context: Context
    ): NotificationManager {
        return NotificationManager(context)
    }
}