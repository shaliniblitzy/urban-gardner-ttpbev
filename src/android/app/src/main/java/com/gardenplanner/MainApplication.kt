package com.gardenplanner

import android.app.Application
import androidx.work.Configuration
import androidx.work.WorkManager
import com.google.firebase.FirebaseApp
import com.google.firebase.perf.FirebasePerformance
import com.google.firebase.perf.metrics.Trace
import com.gardenplanner.core.database.AppDatabase
import com.gardenplanner.core.notifications.NotificationManager
import com.gardenplanner.core.utils.Constants.DATABASE
import dagger.hilt.android.HiltAndroidApp
import java.util.concurrent.TimeUnit

/**
 * Main application class for Garden Planner that initializes core components
 * with enhanced performance monitoring and offline support.
 *
 * Features:
 * - Dependency injection with Hilt
 * - Performance monitoring with Firebase Performance
 * - Reliable background task scheduling with WorkManager
 * - Offline-first database operations
 * - Enhanced notification management
 *
 * @version 1.0
 * @since 2024-01
 */
@HiltAndroidApp
class MainApplication : Application() {

    // Core components with lazy initialization
    lateinit var database: AppDatabase
    lateinit var notificationManager: NotificationManager
    lateinit var workManager: WorkManager
    private lateinit var performanceTrace: Trace

    override fun onCreate() {
        super.onCreate()

        // Start initialization performance trace
        performanceTrace = FirebasePerformance.getInstance().newTrace("app_initialization")
        performanceTrace.start()

        try {
            initializeFirebase()
            initializeWorkManager()
            initializeDatabase()
            initializeNotificationManager()
            setupErrorReporting()
        } finally {
            performanceTrace.stop()
        }
    }

    /**
     * Initializes Firebase services for analytics and performance monitoring
     */
    private fun initializeFirebase() {
        performanceTrace.putMetric("firebase_init_start", System.currentTimeMillis())
        
        FirebaseApp.initializeApp(this)
        FirebasePerformance.getInstance().isPerformanceCollectionEnabled = true
        
        performanceTrace.putMetric("firebase_init_end", System.currentTimeMillis())
    }

    /**
     * Configures WorkManager for reliable background task scheduling
     */
    private fun initializeWorkManager() {
        performanceTrace.putMetric("workmanager_init_start", System.currentTimeMillis())
        
        val config = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .setWorkerFactory(HiltWorkerFactory())
            .build()
            
        WorkManager.initialize(this, config)
        workManager = WorkManager.getInstance(this)
        
        performanceTrace.putMetric("workmanager_init_end", System.currentTimeMillis())
    }

    /**
     * Initializes database with performance monitoring and retention policies
     */
    private fun initializeDatabase() {
        performanceTrace.putMetric("database_init_start", System.currentTimeMillis())
        
        database = AppDatabase.getDatabase(this).apply {
            // Configure performance monitoring
            monitorPerformance()
            
            // Set up retention policies
            configureRetention(
                scheduleRetentionDays = 365L,
                gardenRetentionPolicy = "PERMANENT",
                plantRetentionPolicy = "VERSION_BASED"
            )
        }
        
        performanceTrace.putMetric("database_init_end", System.currentTimeMillis())
    }

    /**
     * Initializes notification manager with offline support and task prioritization
     */
    private fun initializeNotificationManager() {
        performanceTrace.putMetric("notification_init_start", System.currentTimeMillis())
        
        notificationManager = NotificationManager(this).apply {
            // Configure offline notification queue
            configureOfflineQueue(
                maxQueueSize = 100,
                retryInterval = TimeUnit.MINUTES.toMillis(15)
            )
            
            // Set up task prioritization
            setupTaskPrioritization(
                highPriorityTypes = listOf("WATER", "FERTILIZE"),
                mediumPriorityTypes = listOf("HARVEST", "PRUNE"),
                lowPriorityTypes = listOf("PEST_CONTROL", "WEEDING")
            )
        }
        
        performanceTrace.putMetric("notification_init_end", System.currentTimeMillis())
    }

    /**
     * Sets up error reporting and monitoring
     */
    private fun setupErrorReporting() {
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            // Log fatal exceptions
            android.util.Log.e(TAG, "Uncaught exception in thread $thread", throwable)
            
            // Ensure data is saved before crash
            database.checkpoint()
            
            // Re-throw exception
            previousHandler?.uncaughtException(thread, throwable)
        }
    }

    override fun onLowMemory() {
        super.onLowMemory()
        
        // Clear non-essential caches
        database.clearMemoryCache()
        
        // Notify performance monitor
        FirebasePerformance.getInstance()
            .newTrace("low_memory_handling")
            .putMetric("free_memory", Runtime.getRuntime().freeMemory())
        
        // Trigger storage optimization
        database.optimizeStorage()
    }

    companion object {
        private const val TAG = "MainApplication"
        private val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
    }
}