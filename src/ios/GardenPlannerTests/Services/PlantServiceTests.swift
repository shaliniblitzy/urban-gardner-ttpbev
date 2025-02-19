//
// PlantServiceTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

final class PlantServiceTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: PlantService!
    private var testPlant: Plant!
    private var testGardenId: String!
    private let testQueue = DispatchQueue(label: "com.gardenplanner.tests.plantservice")
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        sut = PlantService.shared
        testGardenId = UUID().uuidString
        
        // Create test plant with valid parameters
        testPlant = Plant(
            id: UUID().uuidString,
            type: "Tomato",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 75,
            minSunlightHours: 6,
            companionPlants: ["Basil", "Marigold"],
            incompatiblePlants: ["Potato", "Fennel"],
            expectedYieldKg: 3.5,
            isPerennial: false
        )
    }
    
    override func tearDown() {
        // Clean up test data
        _ = try? sut.executeInTransaction {
            try sut.executeQuery("DELETE FROM plants WHERE id = ?", parameters: [testPlant.id])
            try sut.executeQuery("DELETE FROM gardens WHERE id = ?", parameters: [testGardenId])
        }
        
        testPlant = nil
        testGardenId = nil
        super.tearDown()
    }
    
    // MARK: - Plant Saving Tests
    
    func testSavePlantSuccess() throws {
        // Given
        let expectation = XCTestExpectation(description: "Save plant")
        
        // When
        testQueue.async {
            let result = self.sut.savePlant(self.testPlant, gardenId: self.testGardenId)
            
            // Then
            switch result {
            case .success:
                expectation.fulfill()
            case .failure(let error):
                XCTFail("Failed to save plant: \(error.localizedDescription)")
            }
        }
        
        wait(for: [expectation], timeout: 5.0)
        
        // Verify plant was saved
        let savedPlant = try sut.executeQuery(
            "SELECT * FROM plants WHERE id = ?",
            parameters: [testPlant.id]
        )
        XCTAssertNotNil(try savedPlant.next())
    }
    
    func testSavePlantInvalidSpacing() {
        // Given
        let invalidPlant = Plant(
            id: UUID().uuidString,
            type: "Invalid",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: GardenValidation.maxArea + 1, // Invalid spacing
            daysToMaturity: 60,
            minSunlightHours: 6,
            companionPlants: [],
            incompatiblePlants: [],
            expectedYieldKg: 1.0,
            isPerennial: false
        )
        
        // When
        let result = sut.savePlant(invalidPlant, gardenId: testGardenId)
        
        // Then
        switch result {
        case .success:
            XCTFail("Should not save plant with invalid spacing")
        case .failure(let error):
            XCTAssertEqual(error.code, .invalidGardenDimensions)
        }
    }
    
    func testSavePlantConcurrent() {
        // Given
        let plantsCount = 5
        let saveExpectation = XCTestExpectation(description: "Save multiple plants")
        saveExpectation.expectedFulfillmentCount = plantsCount
        
        // When
        for i in 0..<plantsCount {
            let plant = Plant(
                id: UUID().uuidString,
                type: "Test Plant \(i)",
                sunlightNeeds: SunlightConditions.fullSun,
                spacing: 1.0,
                daysToMaturity: 60,
                minSunlightHours: 6,
                companionPlants: [],
                incompatiblePlants: [],
                expectedYieldKg: 1.0,
                isPerennial: false
            )
            
            testQueue.async {
                let result = self.sut.savePlant(plant, gardenId: self.testGardenId)
                if case .success = result {
                    saveExpectation.fulfill()
                }
            }
        }
        
        // Then
        wait(for: [saveExpectation], timeout: 10.0)
    }
    
    // MARK: - Plant Compatibility Tests
    
    func testPlantCompatibilityCheck() {
        // Given
        let compatiblePlant = Plant(
            id: UUID().uuidString,
            type: "Basil",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 1.0,
            daysToMaturity: 45,
            minSunlightHours: 6,
            companionPlants: ["Tomato"],
            incompatiblePlants: [],
            expectedYieldKg: 0.5,
            isPerennial: false
        )
        
        let incompatiblePlant = Plant(
            id: UUID().uuidString,
            type: "Potato",
            sunlightNeeds: SunlightConditions.partialShade,
            spacing: 2.0,
            daysToMaturity: 90,
            minSunlightHours: 4,
            companionPlants: [],
            incompatiblePlants: ["Tomato"],
            expectedYieldKg: 2.0,
            isPerennial: false
        )
        
        // When & Then
        let compatibleResult = sut.checkPlantCompatibility(testPlant, compatiblePlant)
        XCTAssertEqual(compatibleResult, .success(true))
        
        let incompatibleResult = sut.checkPlantCompatibility(testPlant, incompatiblePlant)
        XCTAssertEqual(incompatibleResult, .success(false))
    }
    
    // MARK: - Maintenance Schedule Tests
    
    func testMaintenanceScheduleGeneration() {
        // Given
        let weatherData = [
            "rainfall": 0.0,
            "temperature": 25.0
        ]
        
        // When
        let result = sut.calculateMaintenanceSchedule(for: testPlant, weatherData: weatherData)
        
        // Then
        switch result {
        case .success(let schedule):
            XCTAssertNotNil(schedule)
            XCTAssertEqual(schedule.plant.id, testPlant.id)
            XCTAssertGreaterThan(schedule.dueDate, Date())
            
            // Verify watering schedule
            if schedule.taskType == "WATERING" {
                XCTAssertEqual(schedule.recurringFrequencyDays, testPlant.wateringFrequencyDays)
            }
            
            // Verify notification settings
            XCTAssertEqual(schedule.reminderTime, NotificationPreferences.defaultReminderTime)
            
        case .failure(let error):
            XCTFail("Failed to generate maintenance schedule: \(error.localizedDescription)")
        }
    }
    
    func testMaintenanceScheduleWithWeatherAdjustment() {
        // Given
        let weatherData = [
            "rainfall": 2.0, // Should delay watering schedule
            "temperature": 30.0
        ]
        
        // When
        let result = sut.calculateMaintenanceSchedule(for: testPlant, weatherData: weatherData)
        
        // Then
        switch result {
        case .success(let schedule):
            XCTAssertNotNil(schedule)
            
            // Verify weather adjustment
            if schedule.taskType == "WATERING" {
                let calendar = Calendar.current
                let daysUntilDue = calendar.dateComponents([.day], from: Date(), to: schedule.dueDate).day ?? 0
                XCTAssertGreaterThan(daysUntilDue, testPlant.wateringFrequencyDays)
            }
            
        case .failure(let error):
            XCTFail("Failed to generate weather-adjusted schedule: \(error.localizedDescription)")
        }
    }
}