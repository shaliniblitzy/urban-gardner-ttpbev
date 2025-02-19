package com.gardenplanner.domain.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

/**
 * Domain model representing a plant with its growth requirements and characteristics.
 * Implements Parcelable for efficient data transfer between Android components.
 *
 * @property id Unique identifier for the plant
 * @property name Common name of the plant
 * @property spacing Required spacing between plants in square feet
 * @property quantity Number of plants to grow
 * @property sunlightHours Daily sunlight requirement in hours
 * @property daysToMaturity Number of days from planting to harvest
 * @property wateringFrequency How often the plant needs watering (e.g., "DAILY", "WEEKLY")
 * @property companionPlants List of plant IDs that grow well with this plant
 * @property incompatiblePlants List of plant IDs that should not be planted nearby
 */
@Parcelize
data class Plant(
    val id: String,
    val name: String,
    val spacing: Float,
    val quantity: Int,
    val sunlightHours: Int,
    val daysToMaturity: Int,
    val wateringFrequency: String,
    val companionPlants: List<String>,
    val incompatiblePlants: List<String>
) : Parcelable {

    /**
     * Validates plant data according to business rules.
     *
     * @return true if plant data is valid, false otherwise
     */
    fun validate(): Boolean {
        return name.isNotBlank() &&
                spacing > 0f &&
                quantity > 0 &&
                sunlightHours in 0..24 &&
                daysToMaturity > 0 &&
                isValidWateringFrequency(wateringFrequency)
    }

    /**
     * Calculates total space required for the plant quantity.
     * Includes spacing buffer for accessibility.
     *
     * @return Total square feet required for the plant
     */
    fun calculateSpaceRequired(): Float {
        val baseArea = spacing * spacing * quantity
        val accessibilityBuffer = 1.2f // 20% extra space for access
        return baseArea * accessibilityBuffer
    }

    /**
     * Checks if this plant is compatible with another plant.
     *
     * @param otherPlant The plant to check compatibility with
     * @return true if plants are compatible, false otherwise
     */
    fun isCompatibleWith(otherPlant: Plant): Boolean {
        return !incompatiblePlants.contains(otherPlant.id) &&
                (companionPlants.contains(otherPlant.id) || 
                otherPlant.companionPlants.contains(this.id))
    }

    /**
     * Validates the watering frequency value.
     *
     * @param frequency The watering frequency to validate
     * @return true if frequency is valid, false otherwise
     */
    private fun isValidWateringFrequency(frequency: String): Boolean {
        return frequency.uppercase() in setOf(
            "DAILY",
            "TWICE_WEEKLY",
            "WEEKLY",
            "BIWEEKLY",
            "MONTHLY"
        )
    }

    companion object {
        /**
         * Minimum spacing allowed between plants in square feet
         */
        const val MIN_SPACING = 0.25f

        /**
         * Maximum spacing allowed between plants in square feet
         */
        const val MAX_SPACING = 10.0f
    }
}