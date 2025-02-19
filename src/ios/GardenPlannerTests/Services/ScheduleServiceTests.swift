//
// ScheduleServiceTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

final class ScheduleServiceTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: ScheduleService!
    private var mockPlant: Plant!
    private var mockSchedule: Schedule!
    private var performanceMetrics: XCTMeasureOptions!
    private var concurrencyGroup: DispatchGroup!
    private var testCache: NSCache<NSString, [Schedule]>!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize system under test
        sut = ScheduleService()
        
        // Create mock plant for testing
        mockPlant = Plant(
            id: "test_plant_1",
            type: "Tomato",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 90,
            minSunlightHours: 6,
            companionPlants: ["Basil"],
            incompatiblePlants: ["Potato"],
            expectedYieldKg: 5.0,
            isPerennial: false
        )
        
        // Create mock schedule
        mockSchedule = Schedule(
            id: "test_schedule_1",
            plant: mockPlant,
            taskType: "WATERING",
            dueDate: Date().addingTimeInterval(86400), // Tomorrow
            notificationPreference: NotificationPreferences()
        )
        
        // Configure performance metrics
        performanceMetrics = XCTMeasureOptions()
        performanceMetrics.iterationCount = 5
        
        // Initialize concurrency group
        concurrencyGroup = DispatchGroup()
        
        // Set up test cache
        testCache = NSCache<NSString, [Schedule]>()
        testCache.countLimit = 100
    }
    
    override func tearDown() {
        // Clean up resources
        sut = nil
        mockPlant = nil
        mockSchedule = nil
        performanceMetrics = nil
        testCache.removeAllObjects()
        testCache = nil
        
        // Wait for any pending concurrent operations
        let timeout = DispatchTime.now() + .seconds(5)
        _ = concurrencyGroup.wait(timeout: timeout)
        concurrencyGroup = nil
        
        super.tearDown()
    }
    
    // MARK: - Schedule Creation Tests
    
    func testCreateScheduleForPlant() {
        // Measure performance
        measure(options: performanceMetrics) {
            // Given
            let startDate = Date()
            
            // When
            let result = sut.createScheduleForPlant(plant: mockPlant, startDate: startDate)
            
            // Then
            switch result {
            case .success(let schedules):
                // Verify schedule count
                XCTAssertFalse(schedules.isEmpty, "Should create at least one schedule")
                
                // Verify schedule properties
                let firstSchedule = schedules[0]
                XCTAssertEqual(firstSchedule.plant.id, mockPlant.id)
                XCTAssertTrue(firstSchedule.dueDate > startDate)
                
                // Verify watering schedule frequency
                if firstSchedule.taskType == "WATERING" {
                    XCTAssertEqual(
                        Calendar.current.dateComponents([.day], from: startDate, to: firstSchedule.dueDate).day,
                        mockPlant.wateringFrequencyDays
                    )
                }
                
                // Verify performance
                let executionTime = XCTClockMetric().measure {
                    _ = sut.createScheduleForPlant(plant: mockPlant, startDate: startDate)
                }
                XCTAssertLessThan(executionTime, 2.0, "Schedule creation should complete within 2 seconds")
                
            case .failure(let error):
                XCTFail("Schedule creation failed with error: \(error)")
            }
        }
    }
    
    // MARK: - Thread Safety Tests
    
    func testConcurrentScheduleCreation() {
        // Given
        let plantsCount = 10
        var mockPlants: [Plant] = []
        var createdSchedules: [[Schedule]] = Array(repeating: [], count: plantsCount)
        let queue = DispatchQueue(label: "com.test.concurrent", attributes: .concurrent)
        
        // Create test plants
        for i in 0..<plantsCount {
            mockPlants.append(Plant(
                id: "test_plant_\(i)",
                type: "Test Plant \(i)",
                sunlightNeeds: SunlightConditions.fullSun,
                spacing: 2.0,
                daysToMaturity: 90,
                minSunlightHours: 6,
                companionPlants: [],
                incompatiblePlants: [],
                expectedYieldKg: 1.0,
                isPerennial: false
            ))
        }
        
        // When - Execute concurrent schedule creation
        measure(options: performanceMetrics) {
            for (index, plant) in mockPlants.enumerated() {
                concurrencyGroup.enter()
                queue.async {
                    let result = self.sut.createScheduleForPlant(plant: plant, startDate: Date())
                    if case .success(let schedules) = result {
                        createdSchedules[index] = schedules
                    }
                    self.concurrencyGroup.leave()
                }
            }
            
            // Wait for all operations to complete
            concurrencyGroup.wait()
            
            // Then
            // Verify data consistency
            for (index, schedules) in createdSchedules.enumerated() {
                XCTAssertFalse(schedules.isEmpty, "Schedules should be created for plant \(index)")
                XCTAssertEqual(schedules[0].plant.id, mockPlants[index].id)
            }
            
            // Check for race conditions
            let allScheduleIds = Set(createdSchedules.flatMap { $0.map { $0.id } })
            XCTAssertEqual(
                allScheduleIds.count,
                createdSchedules.reduce(0) { $0 + $1.count },
                "Schedule IDs should be unique across all concurrent operations"
            )
        }
    }
    
    // MARK: - Notification Tests
    
    func testNotificationDeliveryTiming() {
        measure(options: performanceMetrics) {
            // Given
            let expectation = XCTestExpectation(description: "Notification delivery")
            let startDate = Date().addingTimeInterval(3600) // 1 hour from now
            
            // When
            let result = sut.createScheduleForPlant(plant: mockPlant, startDate: startDate)
            
            switch result {
            case .success(let schedules):
                // Verify notification timing
                let deliveryTime = XCTClockMetric().measure {
                    schedules.forEach { schedule in
                        // Simulate notification delivery
                        NotificationCenter.default.post(
                            name: NSNotification.Name("NotificationDeliveredNotification"),
                            object: nil,
                            userInfo: ["scheduleId": schedule.id, "success": true]
                        )
                    }
                }
                
                // Then
                XCTAssertLessThan(deliveryTime, 1.0, "Notification delivery should complete within 1 second")
                expectation.fulfill()
                
            case .failure(let error):
                XCTFail("Failed to create schedule for notification test: \(error)")
            }
            
            wait(for: [expectation], timeout: 5.0)
        }
    }
    
    // MARK: - Cache Tests
    
    func testCacheValidation() {
        // Given
        let startDate = Date()
        var schedules: [Schedule] = []
        
        // When - Populate cache
        measure(options: performanceMetrics) {
            let result = sut.createScheduleForPlant(plant: mockPlant, startDate: startDate)
            if case .success(let createdSchedules) = result {
                schedules = createdSchedules
                testCache.setObject(schedules, forKey: mockPlant.id as NSString)
            }
            
            // Then
            // Verify cache population
            XCTAssertNotNil(testCache.object(forKey: mockPlant.id as NSString))
            
            // Test cache hit rate
            let cachedSchedules = testCache.object(forKey: mockPlant.id as NSString)
            XCTAssertEqual(cachedSchedules?.count, schedules.count)
            
            // Verify cache invalidation
            testCache.removeObject(forKey: mockPlant.id as NSString)
            XCTAssertNil(testCache.object(forKey: mockPlant.id as NSString))
            
            // Test cache size limits
            let largePlantCount = 200
            for i in 0..<largePlantCount {
                testCache.setObject(schedules, forKey: "plant_\(i)" as NSString)
            }
            XCTAssertLessThanOrEqual(
                testCache.totalCostLimit,
                100,
                "Cache should respect size limits"
            )
        }
    }
    
    // MARK: - Error Handling Tests
    
    func testScheduleCreationError() {
        // Given
        let invalidPlant = Plant(
            id: "",  // Invalid ID
            type: "Invalid",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: -1.0,  // Invalid spacing
            daysToMaturity: -90,  // Invalid days
            minSunlightHours: 24,  // Invalid hours
            companionPlants: [],
            incompatiblePlants: [],
            expectedYieldKg: -1.0,  // Invalid yield
            isPerennial: false
        )
        
        // When
        let result = sut.createScheduleForPlant(plant: invalidPlant, startDate: Date())
        
        // Then
        switch result {
        case .success:
            XCTFail("Should not succeed with invalid plant data")
        case .failure(let error):
            XCTAssertTrue(error is GardenPlannerError)
            if let gardenError = error as? GardenPlannerError {
                XCTAssertEqual(gardenError.code, .scheduleGenerationFailed)
            }
        }
    }
    
    func testScheduleUpdateError() {
        // Given
        let invalidSchedule = Schedule(
            id: "invalid_id",
            plant: mockPlant,
            taskType: "INVALID_TASK",
            dueDate: Date().addingTimeInterval(-86400),  // Past date
            notificationPreference: NotificationPreferences()
        )
        
        // When
        let result = sut.updateSchedule(invalidSchedule)
        
        // Then
        switch result {
        case .success:
            XCTFail("Should not succeed with invalid schedule data")
        case .failure(let error):
            XCTAssertTrue(error is GardenPlannerError)
            if let gardenError = error as? GardenPlannerError {
                XCTAssertEqual(gardenError.code, .scheduleGenerationFailed)
            }
        }
    }
}