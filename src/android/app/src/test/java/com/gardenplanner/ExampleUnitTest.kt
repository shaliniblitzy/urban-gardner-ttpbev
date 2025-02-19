package com.gardenplanner

import com.gardenplanner.domain.models.Garden
import com.gardenplanner.domain.models.Plant
import com.gardenplanner.domain.models.Garden.Zone
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.util.Date

/**
 * Comprehensive test suite for Garden Planner core functionality validation.
 * Tests garden area calculations, plant space requirements, and validation rules.
 */
class ExampleUnitTest {

    private lateinit var testGarden: Garden
    private lateinit var testPlant: Plant
    private lateinit var testZone: Zone

    @Before
    fun setUp() {
        // Initialize test plant
        testPlant = Plant(
            id = "test-plant-1",
            name = "Test Tomato",
            spacing = 2.0f,
            quantity = 3,
            sunlightHours = 6,
            daysToMaturity = 60,
            wateringFrequency = "DAILY",
            companionPlants = listOf("test-plant-2"),
            incompatiblePlants = listOf("test-plant-3")
        )

        // Initialize test zone
        testZone = Zone(
            id = "test-zone-1",
            name = "Sunny Zone",
            area = 50f,
            sunlightHours = 6,
            plants = listOf(testPlant.id)
        )

        // Initialize test garden
        testGarden = Garden(
            id = "test-garden-1",
            area = 100f,
            plants = listOf(testPlant),
            zones = listOf(testZone),
            schedules = emptyList(),
            createdAt = Date(),
            lastModifiedAt = Date()
        )
    }

    @Test
    fun testGardenAreaValidation() {
        // Test valid garden area
        assertTrue(testGarden.validate())

        // Test garden area lower bound
        assertThrows(IllegalArgumentException::class.java) {
            Garden(
                id = "invalid-garden",
                area = 0.5f, // Below minimum 1 sq ft
                plants = emptyList(),
                zones = listOf(testZone),
                schedules = emptyList(),
                createdAt = Date()
            )
        }

        // Test garden area upper bound
        assertThrows(IllegalArgumentException::class.java) {
            Garden(
                id = "invalid-garden",
                area = 1001f, // Above maximum 1000 sq ft
                plants = emptyList(),
                zones = listOf(testZone),
                schedules = emptyList(),
                createdAt = Date()
            )
        }

        // Test space utilization calculation
        val utilization = testGarden.calculateSpaceUtilization()
        assertTrue(utilization in 0f..100f)
        assertEquals(testGarden.spaceUtilization, utilization)
    }

    @Test
    fun testPlantSpaceRequirements() {
        // Test space calculation for single plant
        val spaceRequired = testPlant.calculateSpaceRequired()
        assertTrue(spaceRequired > 0f)
        
        // Verify space calculation includes accessibility buffer
        val expectedSpace = testPlant.spacing * testPlant.spacing * testPlant.quantity * 1.2f
        assertEquals(expectedSpace, spaceRequired)

        // Test maximum capacity validation
        val maxPlantQuantity = 20
        val largePlant = testPlant.copy(quantity = maxPlantQuantity)
        
        assertThrows(IllegalArgumentException::class.java) {
            Garden(
                id = "overcrowded-garden",
                area = 50f,
                plants = listOf(largePlant),
                zones = listOf(testZone),
                schedules = emptyList(),
                createdAt = Date()
            )
        }
    }

    @Test
    fun testPlantValidation() {
        // Test valid plant configuration
        assertTrue(testPlant.validate())

        // Test invalid spacing
        val invalidSpacingPlant = testPlant.copy(spacing = -1f)
        assertFalse(invalidSpacingPlant.validate())

        // Test invalid quantity
        val invalidQuantityPlant = testPlant.copy(quantity = 0)
        assertFalse(invalidQuantityPlant.validate())

        // Test invalid sunlight hours
        val invalidSunlightPlant = testPlant.copy(sunlightHours = 25)
        assertFalse(invalidSunlightPlant.validate())

        // Test plant compatibility
        val compatiblePlant = Plant(
            id = "test-plant-2",
            name = "Compatible Plant",
            spacing = 1.0f,
            quantity = 1,
            sunlightHours = 6,
            daysToMaturity = 30,
            wateringFrequency = "WEEKLY",
            companionPlants = listOf(testPlant.id),
            incompatiblePlants = emptyList()
        )
        
        assertTrue(testPlant.isCompatibleWith(compatiblePlant))

        val incompatiblePlant = Plant(
            id = "test-plant-3",
            name = "Incompatible Plant",
            spacing = 1.0f,
            quantity = 1,
            sunlightHours = 6,
            daysToMaturity = 30,
            wateringFrequency = "WEEKLY",
            companionPlants = emptyList(),
            incompatiblePlants = listOf(testPlant.id)
        )
        
        assertFalse(testPlant.isCompatibleWith(incompatiblePlant))
    }

    @Test
    fun testZoneValidation() {
        // Test valid zone
        assertTrue(testZone.validate())

        // Test invalid zone area
        val invalidAreaZone = testZone.copy(area = -1f)
        assertFalse(invalidAreaZone.validate())

        // Test invalid sunlight hours
        val invalidSunlightZone = testZone.copy(sunlightHours = 25)
        assertFalse(invalidSunlightZone.validate())

        // Test zone area validation within garden
        val oversizedZone = testZone.copy(area = 150f)
        assertThrows(IllegalArgumentException::class.java) {
            Garden(
                id = "invalid-zone-garden",
                area = 100f,
                plants = listOf(testPlant),
                zones = listOf(oversizedZone),
                schedules = emptyList(),
                createdAt = Date()
            )
        }
    }
}