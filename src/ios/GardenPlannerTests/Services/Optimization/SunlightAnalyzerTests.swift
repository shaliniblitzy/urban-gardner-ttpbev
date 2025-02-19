//
// SunlightAnalyzerTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

final class SunlightAnalyzerTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: SunlightAnalyzer!
    private var testGarden: Garden!
    private var testQueue: DispatchQueue!
    private var concurrentExpectation: XCTestExpectation!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Create test garden with predefined zones
        let zones = [
            Zone(id: "zone1", area: 400.0, sunlightCondition: SunlightConditions.fullSun),
            Zone(id: "zone2", area: 400.0, sunlightCondition: SunlightConditions.partialShade),
            Zone(id: "zone3", area: 200.0, sunlightCondition: SunlightConditions.fullShade)
        ]
        testGarden = Garden(id: "test-garden", area: 1000.0, zones: zones, plants: [])
        
        // Initialize system under test
        sut = SunlightAnalyzer(garden: testGarden)
        
        // Setup concurrent testing environment
        testQueue = DispatchQueue(label: "com.gardenplanner.test.concurrent",
                                attributes: .concurrent)
    }
    
    override func tearDown() {
        sut = nil
        testGarden = nil
        testQueue = nil
        super.tearDown()
    }
    
    // MARK: - Distribution Analysis Tests
    
    func testAnalyzeSunlightDistribution_WithValidZones_ShouldReturnCorrectDistribution() {
        // Given
        let expectedDistribution: [String: Double] = [
            SunlightConditions.fullSun: 40.0,
            SunlightConditions.partialShade: 40.0,
            SunlightConditions.fullShade: 20.0
        ]
        
        // When
        let startTime = Date()
        let distribution = sut.analyzeSunlightDistribution()
        let executionTime = Date().timeIntervalSince(startTime)
        
        // Then
        XCTAssertEqual(distribution.count, 3, "Should return distribution for all three conditions")
        
        for (condition, percentage) in expectedDistribution {
            XCTAssertEqual(distribution[condition], percentage,
                          accuracy: 0.01,
                          "Distribution for \(condition) should be \(percentage)%")
        }
        
        let totalDistribution = distribution.values.reduce(0.0, +)
        XCTAssertEqual(totalDistribution, 100.0,
                      accuracy: 0.01,
                      "Total distribution should equal 100%")
        
        XCTAssertLessThan(executionTime, 3.0,
                         "Distribution analysis should complete within 3 seconds")
    }
    
    func testAnalyzeSunlightDistribution_WithEmptyGarden_ShouldReturnEmptyDistribution() {
        // Given
        let emptyZones: [Zone] = []
        let emptyGarden = Garden(id: "empty", area: 100.0, zones: emptyZones, plants: [])
        sut = SunlightAnalyzer(garden: emptyGarden)
        
        // When
        let distribution = sut.analyzeSunlightDistribution()
        
        // Then
        XCTAssertTrue(distribution.isEmpty, "Distribution should be empty for garden with no zones")
    }
    
    // MARK: - Validation Tests
    
    func testValidateZoneSunlight_WithValidConfiguration_ShouldReturnSuccess() {
        // When
        let result = sut.validateZoneSunlight()
        
        // Then
        switch result {
        case .success(let isValid):
            XCTAssertTrue(isValid, "Validation should succeed with valid configuration")
        case .failure(let error):
            XCTFail("Validation should not fail with error: \(error)")
        }
    }
    
    func testValidateZoneSunlight_WithInsufficientSunlight_ShouldReturnError() {
        // Given
        let shadeZones = [
            Zone(id: "shade1", area: 600.0, sunlightCondition: SunlightConditions.fullShade),
            Zone(id: "shade2", area: 400.0, sunlightCondition: SunlightConditions.partialShade)
        ]
        let shadeGarden = Garden(id: "shade-garden", area: 1000.0, zones: shadeZones, plants: [])
        sut = SunlightAnalyzer(garden: shadeGarden)
        
        // When
        let result = sut.validateZoneSunlight()
        
        // Then
        switch result {
        case .success:
            XCTFail("Validation should fail with insufficient sunlight")
        case .failure(let error):
            XCTAssertEqual(error, .insufficientSunlight,
                          "Should return insufficientSunlight error")
        }
    }
    
    // MARK: - Optimization Tests
    
    func testFindOptimalZone_WithValidRequirements_ShouldReturnBestZone() {
        // Given
        let requiredSunlight = SunlightConditions.fullSun
        let requiredArea = 200.0
        
        // When
        let optimalZone = sut.findOptimalZone(requiredSunlight: requiredSunlight,
                                            requiredArea: requiredArea)
        
        // Then
        XCTAssertNotNil(optimalZone, "Should find an optimal zone")
        XCTAssertEqual(optimalZone?.sunlightCondition, requiredSunlight,
                      "Optimal zone should match required sunlight condition")
        XCTAssertGreaterThanOrEqual(optimalZone?.area ?? 0, requiredArea,
                                   "Optimal zone should have sufficient area")
    }
    
    func testFindOptimalZone_WithExcessiveArea_ShouldReturnNil() {
        // Given
        let requiredSunlight = SunlightConditions.fullSun
        let requiredArea = 2000.0 // Larger than garden
        
        // When
        let optimalZone = sut.findOptimalZone(requiredSunlight: requiredSunlight,
                                            requiredArea: requiredArea)
        
        // Then
        XCTAssertNil(optimalZone, "Should return nil for excessive area requirement")
    }
    
    // MARK: - Thread Safety Tests
    
    func testConcurrentSunlightAnalysis_WithMultipleThreads_ShouldMaintainDataConsistency() {
        // Given
        let iterationCount = 100
        let concurrentExpectation = expectation(description: "Concurrent operations")
        concurrentExpectation.expectedFulfillmentCount = iterationCount
        
        var results: [String: Double] = [:]
        let resultsQueue = DispatchQueue(label: "com.gardenplanner.test.results")
        
        // When
        for _ in 0..<iterationCount {
            testQueue.async {
                let distribution = self.sut.analyzeSunlightDistribution()
                
                resultsQueue.async {
                    // Accumulate results for verification
                    for (condition, percentage) in distribution {
                        results[condition] = (results[condition] ?? 0.0) + percentage
                    }
                    concurrentExpectation.fulfill()
                }
            }
        }
        
        // Then
        waitForExpectations(timeout: 10.0) { error in
            XCTAssertNil(error, "Concurrent operations should complete without error")
            
            // Verify consistency
            for (condition, total) in results {
                let average = total / Double(iterationCount)
                let expected = self.sut.analyzeSunlightDistribution()[condition] ?? 0.0
                XCTAssertEqual(average, expected,
                              accuracy: 0.01,
                              "Average distribution should match single-threaded result")
            }
        }
    }
    
    // MARK: - Performance Tests
    
    func testPerformanceRequirements_UnderLoad_ShouldMeetThresholds() {
        // Given
        let operationCount = 1000
        
        // When
        measure {
            for _ in 0..<operationCount {
                _ = sut.analyzeSunlightDistribution()
                _ = sut.calculateSunlightScore()
            }
        }
        
        // Then
        // XCTest measure block automatically verifies performance
        // Default threshold is 10% deviation from baseline
    }
    
    func testSunlightScore_WithValidGarden_ShouldReturnOptimalScore() {
        // When
        let score = sut.calculateSunlightScore()
        
        // Then
        XCTAssertGreaterThanOrEqual(score, 0.0, "Score should be non-negative")
        XCTAssertLessThanOrEqual(score, 100.0, "Score should not exceed 100")
        XCTAssertGreaterThanOrEqual(score, 70.0,
                                   "Score should be optimal for test garden configuration")
    }
}