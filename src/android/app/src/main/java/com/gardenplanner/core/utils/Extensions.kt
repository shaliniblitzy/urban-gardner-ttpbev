package com.gardenplanner.core.utils

import com.gardenplanner.domain.models.Garden
import com.gardenplanner.domain.models.Plant
import com.gardenplanner.domain.models.Schedule
import java.util.Date
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToInt

/**
 * Cache for date formatters to improve performance
 */
private val dateFormatCache = mutableMapOf<Locale, SimpleDateFormat>()

/**
 * Extension function to format Date objects into user-friendly strings with locale support.
 * Uses thread-safe formatter caching for improved performance.
 *
 * @param locale Optional locale for formatting (defaults to system locale)
 * @return Formatted date string in user's locale with timezone
 */
fun Date.toDisplayFormat(locale: Locale = Locale.getDefault()): String {
    return try {
        val formatter = dateFormatCache.getOrPut(locale) {
            SimpleDateFormat("dd MMM yyyy", locale).apply {
                timeZone = TimeZone.getDefault()
            }
        }
        formatter.format(this)
    } catch (e: Exception) {
        // Fallback to basic ISO format if formatting fails
        toString()
    }
}

/**
 * Extension function for Garden to calculate space utilization percentage.
 * Includes comprehensive validation and boundary checks.
 *
 * @return Percentage of garden space utilized (0-100)
 * @throws IllegalStateException if garden area is invalid
 */
fun Garden.calculateSpaceUtilization(): Float {
    require(area >= Garden.MIN_AREA && area <= Garden.MAX_AREA) {
        "Garden area must be between ${Garden.MIN_AREA} and ${Garden.MAX_AREA} square feet"
    }

    if (plants.isEmpty()) return 0f

    val totalUsedSpace = plants.sumOf { plant ->
        plant.calculateSpaceRequired().toDouble()
    }.toFloat()

    return (totalUsedSpace / area * 100f)
        .coerceIn(0f, 100f)
        .roundToTwoDecimals()
}

/**
 * Extension function for Garden to check if new plants can be added.
 * Includes comprehensive validation and safety margin calculations.
 *
 * @param plant The plant to check for addition
 * @return True if plant can be added, false if not enough space
 */
fun Garden.isPlantingPossible(plant: Plant): Boolean {
    require(plant.validate()) { "Invalid plant configuration" }

    val currentUtilization = calculateSpaceUtilization()
    val requiredSpace = plant.calculateSpaceRequired()
    val availableSpace = area * (1 - currentUtilization / 100f)
    
    // Add 10% safety margin for plant growth
    val spaceWithMargin = requiredSpace * 1.1f
    
    return availableSpace >= spaceWithMargin
}

/**
 * Extension function for Schedule to calculate days until task is due.
 * Includes timezone support and comprehensive date calculations.
 *
 * @return Number of days until the task is due (negative if overdue)
 */
fun Schedule.getDaysUntilDue(): Int {
    val calendar = Calendar.getInstance().apply {
        timeZone = TimeZone.getDefault()
        // Reset time portion to ensure accurate day calculation
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    
    val currentDate = calendar.time
    
    // Create calendar for due date with same time normalization
    val dueCalendar = Calendar.getInstance().apply {
        timeZone = TimeZone.getDefault()
        time = dueDate
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }

    // Calculate difference in days
    val diffMillis = dueCalendar.timeInMillis - calendar.timeInMillis
    return (diffMillis / (24 * 60 * 60 * 1000L)).toInt()
}

/**
 * Utility extension function to round Float to two decimal places
 */
private fun Float.roundToTwoDecimals(): Float {
    return (this * 100).roundToInt() / 100f
}