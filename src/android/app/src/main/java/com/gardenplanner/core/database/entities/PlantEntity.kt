package com.gardenplanner.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverters
import com.gardenplanner.domain.models.Plant
import com.gardenplanner.core.database.converters.ListTypeConverter

/**
 * Room database entity representing a plant with comprehensive data validation,
 * type conversion, and integrity checks.
 *
 * @property id Unique identifier for the plant
 * @property name Common name of the plant (unique index for efficient lookups)
 * @property spacing Required spacing between plants in square feet
 * @property quantity Number of plants to grow
 * @property sunlightHours Daily sunlight requirement in hours
 * @property daysToMaturity Number of days from planting to harvest
 * @property wateringFrequency How often the plant needs watering
 * @property companionPlants List of plant IDs that grow well with this plant
 * @property incompatiblePlants List of plant IDs that should not be planted nearby
 */
@Entity(
    tableName = "plants",
    indices = [Index(value = ["name"], unique = true)]
)
@TypeConverters(ListTypeConverter::class)
data class PlantEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "spacing")
    val spacing: Float,

    @ColumnInfo(name = "quantity")
    val quantity: Int,

    @ColumnInfo(name = "sunlight_hours")
    val sunlightHours: Int,

    @ColumnInfo(name = "days_to_maturity")
    val daysToMaturity: Int,

    @ColumnInfo(name = "watering_frequency")
    val wateringFrequency: String,

    @ColumnInfo(name = "companion_plants")
    val companionPlants: List<String>,

    @ColumnInfo(name = "incompatible_plants")
    val incompatiblePlants: List<String>
) {

    /**
     * Validates all entity properties according to business rules.
     * @throws IllegalArgumentException if validation fails
     */
    private fun validate() {
        require(id.isNotBlank()) { "Plant ID cannot be blank" }
        require(name.isNotBlank()) { "Plant name cannot be blank" }
        require(spacing >= Plant.MIN_SPACING && spacing <= Plant.MAX_SPACING) {
            "Spacing must be between ${Plant.MIN_SPACING} and ${Plant.MAX_SPACING} square feet"
        }
        require(quantity > 0) { "Quantity must be greater than 0" }
        require(sunlightHours in 0..24) { "Sunlight hours must be between 0 and 24" }
        require(daysToMaturity > 0) { "Days to maturity must be greater than 0" }
        require(isValidWateringFrequency(wateringFrequency)) {
            "Invalid watering frequency: $wateringFrequency"
        }
    }

    /**
     * Validates the watering frequency value.
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

    /**
     * Converts database entity to domain model with comprehensive validation.
     * @return Validated domain model instance
     * @throws IllegalArgumentException if validation fails
     */
    fun toDomainModel(): Plant {
        validate()
        return Plant(
            id = id,
            name = name,
            spacing = spacing,
            quantity = quantity,
            sunlightHours = sunlightHours,
            daysToMaturity = daysToMaturity,
            wateringFrequency = wateringFrequency,
            companionPlants = ArrayList(companionPlants),
            incompatiblePlants = ArrayList(incompatiblePlants)
        )
    }

    companion object {
        /**
         * Creates database entity from domain model with comprehensive validation.
         * @param plant Domain model to convert
         * @return Validated database entity instance
         * @throws IllegalArgumentException if validation fails
         */
        fun fromDomainModel(plant: Plant): PlantEntity {
            require(plant.validate()) { "Invalid plant domain model" }
            
            return PlantEntity(
                id = plant.id,
                name = plant.name,
                spacing = plant.spacing,
                quantity = plant.quantity,
                sunlightHours = plant.sunlightHours,
                daysToMaturity = plant.daysToMaturity,
                wateringFrequency = plant.wateringFrequency,
                companionPlants = ArrayList(plant.companionPlants),
                incompatiblePlants = ArrayList(plant.incompatiblePlants)
            ).also { it.validate() }
        }
    }
}