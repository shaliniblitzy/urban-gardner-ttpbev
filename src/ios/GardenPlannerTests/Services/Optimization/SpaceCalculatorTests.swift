//
// SpaceCalculatorTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

final class SpaceCalculatorTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: SpaceCalculator!
    private var testGarden: Garden!
    private var testPlants: [Plant]!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize system under test
        sut = SpaceCalculator()
        
        // Create test garden with known dimensions
        let zone1 = Zone(id: "zone1", area: 25.0, sunlightCondition: SunlightConditions.fullSun)
        let zone2 = Zone(id: "zone2", area: 25.0, sunlightCondition: SunlightConditions.partialShade)
        testGarden = Garden(id: "test-garden", area: 50.0, zones: [zone1, zone2], plants: [])
        
        // Create test plants with known spacing requirements
        testPlants = [
            Plant(id: "tomato1", type: "Tomato", sunlightNeeds: SunlightConditions.fullSun,
                  spacing: 2.0, daysToMaturity: 80, minSunlightHours: 6,
                  companionPlants: ["Basil"], incompatiblePlants: ["Potato"],
                  expectedYieldKg: 3.0, isPerennial: false),
            Plant(id: "lettuce1", type: "Lettuce", sunlightNeeds: SunlightConditions.partialShade,
                  spacing: 1.0, daysToMaturity: 45, minSunlightHours: 4,
                  companionPlants: ["Carrot"], incompatiblePlants: [],
                  expectedYieldKg: 0.5, isPerennial: false)
        ]
    }
    
    override func tearDown() {
        sut = nil
        testGarden = nil
        testPlants = nil
        super.tearDown()
    }
    
    // MARK: - Test Cases
    
    func testCalculateOptimalPlantCount() {
        // Given
        let area = 100.0
        let plantSpacing = 2.0
        let expectedCount = 25 // Based on 90% utilization target
        
        // When
        let actualCount = sut.calculateOptimalPlantCount(area: area, plantSpacing: plantSpacing)
        
        // Then
        XCTAssertEqual(actualCount, expectedCount, "Optimal plant count should match expected value")
        
        // Test boundary conditions
        XCTAssertEqual(sut.calculateOptimalPlantCount(area: 0, plantSpacing: 2.0), 0,
                      "Should return 0 for invalid area")
        XCTAssertEqual(sut.calculateOptimalPlantCount(area: 100, plantSpacing: 0), 0,
                      "Should return 0 for invalid spacing")
    }
    
    func testValidatePlantSpacing() {
        // Given
        let zone = testGarden.zones[0]
        var layout: [Zone: [Plant]] = [:]
        
        // When - Compatible plants
        layout[zone] = [testPlants[0]] // Single tomato plant
        
        // Then
        XCTAssertTrue(sut.validatePlantSpacing(layout),
                     "Single plant should have valid spacing")
        
        // When - Incompatible plants
        let potatoPlant = Plant(id: "potato1", type: "Potato",
                               sunlightNeeds: SunlightConditions.fullSun,
                               spacing: 2.0, daysToMaturity: 90, minSunlightHours: 6,
                               companionPlants: [], incompatiblePlants: ["Tomato"],
                               expectedYieldKg: 2.0, isPerennial: false)
        layout[zone] = [testPlants[0], potatoPlant]
        
        // Then
        XCTAssertFalse(sut.validatePlantSpacing(layout),
                      "Incompatible plants should fail spacing validation")
    }
    
    func testOptimizeLayout() {
        // Given
        let expectedUtilization = 0.9 // 90% target utilization
        
        // When
        let optimizedLayout = sut.optimizeLayout(garden: testGarden, plants: testPlants)
        
        // Then
        XCTAssertFalse(optimizedLayout.isEmpty, "Layout should not be empty")
        
        // Verify zone assignments
        XCTAssertTrue(optimizedLayout[testGarden.zones[0]]?.contains { $0.type == "Tomato" } ?? false,
                     "Tomato should be in full sun zone")
        XCTAssertTrue(optimizedLayout[testGarden.zones[1]]?.contains { $0.type == "Lettuce" } ?? false,
                     "Lettuce should be in partial shade zone")
        
        // Verify space utilization
        let actualUtilization = sut.calculateUtilization(layout: optimizedLayout,
                                                       totalArea: testGarden.area)
        XCTAssertGreaterThanOrEqual(actualUtilization, expectedUtilization,
                                   "Space utilization should meet target")
    }
    
    func testCalculateUtilization() {
        // Given
        let zone = testGarden.zones[0]
        let layout: [Zone: [Plant]] = [zone: [testPlants[0]]] // Single tomato plant
        let expectedUtilization = testPlants[0].spacing / zone.area
        
        // When
        let actualUtilization = sut.calculateUtilization(layout: layout,
                                                       totalArea: zone.area)
        
        // Then
        XCTAssertEqual(actualUtilization, expectedUtilization,
                      accuracy: 0.01,
                      "Utilization calculation should match expected value")
        
        // Test maximum utilization
        XCTAssertLessThanOrEqual(actualUtilization, 1.0,
                                "Utilization should not exceed 100%")
    }
    
    func testPerformanceOptimizeLayout() {
        // Given
        let largeGarden = Garden(
            id: "large-garden",
            area: GardenValidation.maxArea,
            zones: [
                Zone(id: "zone1", area: 500.0, sunlightCondition: SunlightConditions.fullSun),
                Zone(id: "zone2", area: 500.0, sunlightCondition: SunlightConditions.partialShade)
            ],
            plants: []
        )
        
        var largePlantSet: [Plant] = []
        for i in 0..<100 {
            largePlantSet.append(Plant(
                id: "plant\(i)",
                type: i % 2 == 0 ? "Tomato" : "Lettuce",
                sunlightNeeds: i % 2 == 0 ? SunlightConditions.fullSun : SunlightConditions.partialShade,
                spacing: Double(i % 3 + 1),
                daysToMaturity: 60 + i,
                minSunlightHours: 4 + (i % 3),
                companionPlants: [],
                incompatiblePlants: [],
                expectedYieldKg: 1.0,
                isPerennial: false
            ))
        }
        
        // When/Then
        measure {
            let layout = sut.optimizeLayout(garden: largeGarden, plants: largePlantSet)
            XCTAssertFalse(layout.isEmpty, "Layout optimization should complete successfully")
        }
    }
}