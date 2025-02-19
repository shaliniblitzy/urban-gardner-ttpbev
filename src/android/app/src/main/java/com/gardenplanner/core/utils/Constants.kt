package com.gardenplanner.core.utils

/**
 * Central constants file containing application-wide configuration values,
 * validation rules, and default settings for the Garden Planner application.
 */

/**
 * Validation constants for garden and plant parameters
 */
object VALIDATION {
    // Garden area limits in square feet
    const val MIN_GARDEN_AREA: Float = 1.0f
    const val MAX_GARDEN_AREA: Float = 1000.0f

    // Plant quantity limits per variety
    const val MIN_PLANT_QUANTITY: Int = 1
    const val MAX_PLANT_QUANTITY: Int = 100

    // Sunlight hours range for zones
    const val MIN_SUNLIGHT_HOURS: Int = 0
    const val MAX_SUNLIGHT_HOURS: Int = 24
}

/**
 * Constants for schedule management and notifications
 */
object SCHEDULE {
    // Default notification settings
    const val DEFAULT_NOTIFICATION_TIME: String = "09:00"
    const val NOTIFICATION_CHANNEL_ID: String = "com.gardenplanner.notifications.maintenance"
    const val NOTIFICATION_CHANNEL_NAME: String = "Maintenance Reminders"

    // Supported maintenance task types
    val TASK_TYPES: List<String> = listOf(
        "WATER",
        "FERTILIZE",
        "PRUNE",
        "HARVEST",
        "PEST_CONTROL"
    )
}

/**
 * Database configuration constants
 */
object DATABASE {
    const val DATABASE_NAME: String = "garden_planner.db"
    const val DATABASE_VERSION: Int = 1
}

/**
 * SharedPreferences keys and default values
 */
object PREFERENCES {
    const val PREF_FILE_NAME: String = "garden_planner_preferences"
    const val KEY_NOTIFICATIONS_ENABLED: String = "notifications_enabled"
    const val KEY_NOTIFICATION_TIME: String = "notification_time"
}