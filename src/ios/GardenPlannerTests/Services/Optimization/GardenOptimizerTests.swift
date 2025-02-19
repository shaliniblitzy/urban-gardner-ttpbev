//
// GardenOptimizerTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

final class GardenOptimizerTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: GardenOptimizer!
    private var testGarden: Garden!
    private var performanceMetrics: XCTMeasureOptions!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Create test garden with 500 sq ft area
        let gardenId = UUID().uuidString
        
        // Create test zones with varying sunlight conditions
        let zone1 = Zone(id: UUID().uuidString, area: 200.0, sunlightCondition: SunlightConditions.fullSun)
        let zone2 = Zone(id: UUID().uuidString, area: 200.0, sunlightCondition: SunlightConditions.partialShade)
        let zone3 = Zone(id: UUID().uuidString, area: 100.0, sunlightCondition: SunlightConditions.fullShade)
        
        // Create test plants with known spacing requirements
        let tomatoes = Plant(
            id: UUID().uuidString,
            type: "Tomatoes",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 75,
            minSunlightHours: 6,
            companionPlants: ["Basil", "Carrots"],
            incompatiblePlants: ["Potatoes"],
            expectedYieldKg: 4.5,
            isPerennial: false
        )
        
        let lettuce = Plant(
            id: UUID().uuidString,
            type: "Lettuce",
            sunlightNeeds: SunlightConditions.partialShade,
            spacing: 1.0,
            daysToMaturity: 45,
            minSunlightHours: 4,
            companionPlants: ["Carrots", "Radishes"],
            incompatiblePlants: [],
            expectedYieldKg: 1.2,
            isPerennial: false
        )
        
        // Initialize test garden
        testGarden = Garden(
            id: gardenId,
            area: 500.0,
            zones: [zone1, zone2, zone3],
            plants: [tomatoes, lettuce]
        )
        
        // Initialize system under test
        sut = GardenOptimizer(garden: testGarden)
        
        // Configure performance metrics
        performanceMetrics = XCTMeasureOptions()
        performanceMetrics.iterationCount = 5
    }
    
    override func tearDown() {
        sut = nil
        testGarden = nil
        performanceMetrics = nil
        super.tearDown()
    }
    
    // MARK: - Tests
    
    func testOptimizeGardenLayout() {
        // Given
        let initialUtilization = testGarden.calculateSpaceUtilization()
        
        // When
        let result = sut.optimizeGardenLayout()
        
        // Then
        XCTAssertTrue(result.isSuccess, "Garden layout optimization should succeed")
        
        if case .success = result {
            let finalUtilization = testGarden.calculateSpaceUtilization()
            XCTAssertGreaterThanOrEqual(
                finalUtilization,
                initialUtilization * 1.3,
                "Space utilization should improve by at least 30%"
            )
            
            // Verify plant placement
            for zone in testGarden.zones {
                for plant in zone.plants {
                    // Verify sunlight compatibility
                    XCTAssertTrue(
                        plant.sunlightNeeds == zone.sunlightCondition ||
                        (plant.sunlightNeeds == SunlightConditions.partialShade &&
                         zone.sunlightCondition == SunlightConditions.fullSun),
                        "Plants should be placed in compatible sunlight zones"
                    )
                    
                    // Verify spacing requirements
                    XCTAssertLessThanOrEqual(
                        plant.spacing,
                        zone.getAvailableSpace(),
                        "Plant spacing should not exceed available space"
                    )
                    
                    // Verify companion planting rules
                    for otherPlant in zone.plants where otherPlant.id != plant.id {
                        XCTAssertTrue(
                            plant.isCompatibleWith(otherPlant),
                            "Plants in the same zone should be compatible"
                        )
                    }
                }
            }
        }
    }
    
    func testOptimizationPerformance() {
        // Given
        let largeGarden = Garden(
            id: UUID().uuidString,
            area: GardenValidation.maxArea,
            zones: [
                Zone(id: UUID().uuidString, area: 400.0, sunlightCondition: SunlightConditions.fullSun),
                Zone(id: UUID().uuidString, area: 400.0, sunlightCondition: SunlightConditions.partialShade),
                Zone(id: UUID().uuidString, area: 200.0, sunlightCondition: SunlightConditions.fullShade)
            ],
            plants: []
        )
        
        // Add maximum supported plants
        for _ in 0..<50 {
            let plant = Plant(
                id: UUID().uuidString,
                type: "TestPlant",
                sunlightNeeds: SunlightConditions.fullSun,
                spacing: 2.0,
                daysToMaturity: 60,
                minSunlightHours: 6,
                companionPlants: [],
                incompatiblePlants: [],
                expectedYieldKg: 1.0,
                isPerennial: false
            )
            largeGarden.addPlant(plant, to: largeGarden.zones[0])
        }
        
        sut = GardenOptimizer(garden: largeGarden)
        
        // When/Then
        measure(options: performanceMetrics) {
            let result = sut.optimizeGardenLayout()
            XCTAssertTrue(result.isSuccess, "Optimization should succeed within performance constraints")
        }
    }
    
    func testCalculateOptimizationScore() {
        // Given
        let optimalGarden = Garden(
            id: UUID().uuidString,
            area: 100.0,
            zones: [
                Zone(id: UUID().uuidString, area: 60.0, sunlightCondition: SunlightConditions.fullSun),
                Zone(id: UUID().uuidString, area: 40.0, sunlightCondition: SunlightConditions.partialShade)
            ],
            plants: []
        )
        
        sut = GardenOptimizer(garden: optimalGarden)
        
        // When
        let score = sut.calculateOptimizationScore()
        
        // Then
        XCTAssertGreaterThanOrEqual(score.overall, 0.8, "Optimal layout should score at least 0.8")
        XCTAssertGreaterThanOrEqual(score.spaceUtilization, 0.7, "Space utilization should be at least 70%")
        XCTAssertGreaterThanOrEqual(score.sunlightEfficiency, 0.8, "Sunlight efficiency should be at least 80%")
        XCTAssertGreaterThanOrEqual(score.plantCompatibility, 0.9, "Plant compatibility should be at least 90%")
        XCTAssertLessThanOrEqual(Date().timeIntervalSince(score.timestamp), 1.0, "Score should be recently calculated")
    }
    
    func testValidateOptimization() {
        // Given
        let validGarden = testGarden!
        sut = GardenOptimizer(garden: validGarden)
        
        // When
        let result = sut.validateOptimization()
        
        // Then
        XCTAssertTrue(result.isValid, "Valid garden configuration should pass validation")
        XCTAssertGreaterThanOrEqual(result.spaceUtilization, 0.3, "Space utilization should meet minimum threshold")
        XCTAssertGreaterThanOrEqual(result.sunlightScore, 70.0, "Sunlight score should meet minimum threshold")
        XCTAssertGreaterThanOrEqual(result.compatibilityScore, 80.0, "Compatibility score should meet minimum threshold")
        
        // Test invalid configurations
        let invalidGarden = Garden(
            id: UUID().uuidString,
            area: 50.0, // Too small
            zones: [Zone(id: UUID().uuidString, area: 50.0, sunlightCondition: SunlightConditions.fullShade)],
            plants: []
        )
        
        sut = GardenOptimizer(garden: invalidGarden)
        let invalidResult = sut.validateOptimization()
        XCTAssertFalse(invalidResult.isValid, "Invalid garden configuration should fail validation")
    }
    
    func testSuggestImprovements() {
        // Given
        let suboptimalGarden = Garden(
            id: UUID().uuidString,
            area: 200.0,
            zones: [
                Zone(id: UUID().uuidString, area: 150.0, sunlightCondition: SunlightConditions.fullShade),
                Zone(id: UUID().uuidString, area: 50.0, sunlightCondition: SunlightConditions.fullSun)
            ],
            plants: []
        )
        
        sut = GardenOptimizer(garden: suboptimalGarden)
        
        // When
        let suggestions = sut.suggestImprovements()
        
        // Then
        XCTAssertFalse(suggestions.isEmpty, "Should provide improvement suggestions for suboptimal layout")
        
        // Verify suggestion structure
        for suggestion in suggestions {
            XCTAssertFalse(suggestion.description.isEmpty, "Suggestion should have description")
            XCTAssertGreaterThan(suggestion.impact, 0.0, "Suggestion should have positive impact")
            XCTAssertGreaterThan(suggestion.priority, 0, "Suggestion should have valid priority")
            
            // Verify suggestion types
            XCTAssertTrue(
                ["space", "sunlight", "compatibility"].contains(suggestion.type),
                "Suggestion should have valid type"
            )
        }
        
        // Verify suggestion ordering
        let priorities = suggestions.map { $0.priority }
        XCTAssertEqual(
            priorities,
            priorities.sorted(),
            "Suggestions should be ordered by priority"
        )
    }
}