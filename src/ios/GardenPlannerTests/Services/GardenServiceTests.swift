//
// GardenServiceTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

class GardenServiceTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: GardenService!
    private var testGarden: Garden!
    private var concurrentQueue: DispatchQueue!
    private var asyncExpectation: XCTestExpectation!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize service
        sut = GardenService()
        
        // Setup concurrent testing queue
        concurrentQueue = DispatchQueue(
            label: "com.gardenplanner.tests.concurrent",
            attributes: .concurrent
        )
        
        // Initialize test garden with valid data
        let zoneId = UUID().uuidString
        let zone = Zone(
            id: zoneId,
            area: 25.0,
            sunlightCondition: SunlightConditions.fullSun
        )
        
        let plantId = UUID().uuidString
        let plant = Plant(
            id: plantId,
            type: "Tomato",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 75,
            minSunlightHours: 6,
            companionPlants: ["Basil", "Carrots"],
            incompatiblePlants: ["Potato"],
            expectedYieldKg: 5.0,
            isPerennial: false
        )
        
        testGarden = Garden(
            id: UUID().uuidString,
            area: 25.0,
            zones: [zone],
            plants: [plant]
        )
    }
    
    override func tearDown() {
        sut = nil
        testGarden = nil
        concurrentQueue = nil
        asyncExpectation = nil
        super.tearDown()
    }
    
    // MARK: - Garden Creation Tests
    
    func testCreateGarden_WithValidData_ShouldSucceed() {
        // Given
        let area = 25.0
        let zone = Zone(
            id: UUID().uuidString,
            area: area,
            sunlightCondition: SunlightConditions.fullSun
        )
        let plants: [Plant] = []
        
        // When
        let result = sut.createGarden(area: area, zones: [zone], plants: plants)
        
        // Then
        switch result {
        case .success(let garden):
            XCTAssertNotNil(garden)
            XCTAssertEqual(garden.area, area)
            XCTAssertEqual(garden.zones.count, 1)
            XCTAssertEqual(garden.calculateSpaceUtilization(), 0.0)
        case .failure(let error):
            XCTFail("Garden creation failed with error: \(error)")
        }
    }
    
    func testCreateGarden_WithInvalidArea_ShouldFail() {
        // Given
        let invalidArea = GardenValidation.maxArea + 1
        let zone = Zone(
            id: UUID().uuidString,
            area: invalidArea,
            sunlightCondition: SunlightConditions.fullSun
        )
        
        // When
        let result = sut.createGarden(area: invalidArea, zones: [zone], plants: [])
        
        // Then
        switch result {
        case .success:
            XCTFail("Should fail with invalid area")
        case .failure(let error):
            XCTAssertEqual(
                error,
                GardenService.GardenServiceError.invalidInput("Garden area must be between \(GardenValidation.minArea) and \(GardenValidation.maxArea) sq ft")
            )
        }
    }
    
    // MARK: - Garden Optimization Tests
    
    func testOptimizeGarden_WithValidLayout_ShouldSucceed() {
        // Given
        let startTime = Date()
        
        // When
        let result = sut.optimizeGarden(testGarden)
        
        // Then
        switch result {
        case .success(let optimizedGarden):
            XCTAssertNotNil(optimizedGarden)
            XCTAssertGreaterThan(optimizedGarden.calculateSpaceUtilization(), 0.0)
            
            // Verify performance
            let duration = Date().timeIntervalSince(startTime)
            XCTAssertLessThan(duration, 3.0) // Must complete within 3 seconds
            
        case .failure(let error):
            XCTFail("Garden optimization failed with error: \(error)")
        }
    }
    
    func testOptimizeGarden_WithConcurrentAccess() {
        // Given
        let iterations = 10
        asyncExpectation = expectation(description: "Concurrent optimization")
        asyncExpectation.expectedFulfillmentCount = iterations
        
        // When
        for _ in 0..<iterations {
            concurrentQueue.async {
                let result = self.sut.optimizeGarden(self.testGarden)
                
                // Then
                switch result {
                case .success(let garden):
                    XCTAssertNotNil(garden)
                    XCTAssertGreaterThan(garden.calculateSpaceUtilization(), 0.0)
                case .failure(let error):
                    XCTFail("Concurrent optimization failed with error: \(error)")
                }
                
                self.asyncExpectation.fulfill()
            }
        }
        
        wait(for: [asyncExpectation], timeout: 10.0)
    }
    
    // MARK: - Garden Validation Tests
    
    func testValidateGardenSetup_WithValidConfiguration_ShouldSucceed() {
        // When
        let result = sut.validateGardenSetup(testGarden)
        
        // Then
        switch result {
        case .success(let report):
            XCTAssertTrue(report.errors.isEmpty)
            XCTAssertTrue(report.warnings.isEmpty)
        case .failure(let error):
            XCTFail("Validation failed with error: \(error)")
        }
    }
    
    func testValidateGardenSetup_WithInvalidZoneArea_ShouldFail() {
        // Given
        let invalidZone = Zone(
            id: UUID().uuidString,
            area: testGarden.area + 10.0, // Zone area larger than garden
            sunlightCondition: SunlightConditions.fullSun
        )
        testGarden = Garden(
            id: UUID().uuidString,
            area: testGarden.area,
            zones: [invalidZone],
            plants: []
        )
        
        // When
        let result = sut.validateGardenSetup(testGarden)
        
        // Then
        switch result {
        case .success:
            XCTFail("Should fail with invalid zone area")
        case .failure(let error):
            XCTAssertEqual(error, GardenService.GardenServiceError.validationFailed("Garden validation failed"))
        }
    }
    
    // MARK: - Performance Tests
    
    func testGardenOptimization_Performance() {
        // Given
        let iterations = 100
        
        measure {
            // When
            for _ in 0..<iterations {
                let result = sut.optimizeGarden(testGarden)
                
                // Then
                switch result {
                case .success(let garden):
                    XCTAssertNotNil(garden)
                case .failure(let error):
                    XCTFail("Performance test failed with error: \(error)")
                }
            }
        }
    }
    
    func testGardenValidation_WithLargeDataset() {
        // Given
        var largeZones: [Zone] = []
        for i in 0..<GardenValidation.maxZones {
            let zone = Zone(
                id: "zone_\(i)",
                area: 10.0,
                sunlightCondition: SunlightConditions.fullSun
            )
            largeZones.append(zone)
        }
        
        let largeGarden = Garden(
            id: UUID().uuidString,
            area: Double(GardenValidation.maxZones * 10),
            zones: largeZones,
            plants: []
        )
        
        // When
        let startTime = Date()
        let result = sut.validateGardenSetup(largeGarden)
        let duration = Date().timeIntervalSince(startTime)
        
        // Then
        XCTAssertLessThan(duration, 3.0) // Must validate within 3 seconds
        
        switch result {
        case .success(let report):
            XCTAssertTrue(report.errors.isEmpty)
        case .failure(let error):
            XCTFail("Large dataset validation failed with error: \(error)")
        }
    }
}