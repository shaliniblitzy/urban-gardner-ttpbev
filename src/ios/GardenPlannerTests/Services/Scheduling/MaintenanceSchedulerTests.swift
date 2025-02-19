//
// MaintenanceSchedulerTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

final class MaintenanceSchedulerTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: MaintenanceScheduler!
    private var mockNotificationScheduler: MockNotificationScheduler!
    private let testQueue = DispatchQueue(label: "com.gardenplanner.test", qos: .userInitiated)
    
    // Test expectations
    private var notificationExpectation: XCTestExpectation!
    private var scheduleGenerationExpectation: XCTestExpectation!
    
    // Test data
    private var testPlant: Plant!
    private var testSchedule: Schedule!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize mock notification scheduler
        mockNotificationScheduler = MockNotificationScheduler()
        
        // Initialize system under test
        sut = MaintenanceScheduler(notificationScheduler: mockNotificationScheduler)
        
        // Create test plant
        testPlant = Plant(
            id: UUID().uuidString,
            type: "Tomatoes",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 90,
            minSunlightHours: 6,
            companionPlants: ["Basil", "Carrots"],
            incompatiblePlants: ["Potatoes"],
            expectedYieldKg: 5.0,
            isPerennial: false
        )
        
        // Create test schedule
        testSchedule = Schedule(
            id: UUID().uuidString,
            plant: testPlant,
            taskType: "WATERING",
            dueDate: Date().addingTimeInterval(3600),
            notificationPreference: NotificationPreferences()
        )
    }
    
    override func tearDown() {
        sut = nil
        mockNotificationScheduler = nil
        testPlant = nil
        testSchedule = nil
        super.tearDown()
    }
    
    // MARK: - Schedule Generation Tests
    
    func testScheduleGeneration() throws {
        // Given
        let startDate = Date()
        let periodDays = 30
        scheduleGenerationExpectation = expectation(description: "Schedule generation")
        
        // When
        measure {
            testQueue.async {
                do {
                    let schedules = try self.sut.generateSchedule(
                        for: self.testPlant,
                        startDate: startDate,
                        periodDays: periodDays
                    )
                    
                    // Then
                    XCTAssertFalse(schedules.isEmpty, "Generated schedules should not be empty")
                    XCTAssertEqual(schedules.count, 15, "Should generate correct number of schedules") // 30 days / 2 days watering frequency
                    
                    // Verify schedule properties
                    let firstSchedule = schedules[0]
                    XCTAssertEqual(firstSchedule.plant.id, self.testPlant.id)
                    XCTAssertEqual(firstSchedule.taskType, "WATERING")
                    XCTAssertGreaterThan(firstSchedule.dueDate, startDate)
                    
                    // Verify notification scheduling
                    XCTAssertTrue(self.mockNotificationScheduler.scheduleNotificationCalled)
                    
                    self.scheduleGenerationExpectation.fulfill()
                } catch {
                    XCTFail("Schedule generation failed: \(error)")
                }
            }
        }
        
        // Verify performance
        XCTAssertLessThanOrEqual(
            measure.averageExecutionTime,
            2.0,
            "Schedule generation should complete within 2 seconds"
        )
        
        wait(for: [scheduleGenerationExpectation], timeout: 5.0)
    }
    
    func testScheduleGenerationWithInvalidPeriod() {
        // Given
        let startDate = Date()
        let invalidPeriod = ScheduleConstants.maxScheduleDays + 1
        
        // When/Then
        XCTAssertThrowsError(
            try sut.generateSchedule(for: testPlant, startDate: startDate, periodDays: invalidPeriod)
        ) { error in
            guard let gardenError = error as? GardenPlannerError else {
                XCTFail("Unexpected error type")
                return
            }
            XCTAssertEqual(gardenError.code, .scheduleGenerationFailed)
        }
    }
    
    // MARK: - Schedule Update Tests
    
    func testScheduleCompletion() throws {
        // Given
        notificationExpectation = expectation(description: "Schedule completion notification")
        
        // When
        testQueue.async {
            do {
                try self.sut.updateSchedule(self.testSchedule, completed: true)
                
                // Then
                XCTAssertTrue(self.testSchedule.isCompleted)
                XCTAssertNotNil(self.testSchedule.completedDate)
                
                // Verify next schedule generation for recurring task
                let overdueSchedules = self.sut.getOverdueSchedules()
                XCTAssertTrue(overdueSchedules.isEmpty, "No schedules should be overdue")
                
                self.notificationExpectation.fulfill()
            } catch {
                XCTFail("Schedule completion failed: \(error)")
            }
        }
        
        wait(for: [notificationExpectation], timeout: 5.0)
    }
    
    func testScheduleCompletionWithFeedback() throws {
        // Given
        let feedback = "Plant needed extra water due to heat"
        
        // When
        try sut.updateSchedule(testSchedule, completed: true, feedback: feedback)
        
        // Then
        XCTAssertTrue(testSchedule.isCompleted)
        XCTAssertNotNil(testSchedule.completedDate)
        // Verify feedback processing (implementation dependent)
    }
    
    // MARK: - Overdue Schedule Tests
    
    func testOverdueScheduleRetrieval() throws {
        // Given
        let pastDate = Date().addingTimeInterval(-3600)
        let overdueSchedule = Schedule(
            id: UUID().uuidString,
            plant: testPlant,
            taskType: "WATERING",
            dueDate: pastDate,
            notificationPreference: NotificationPreferences()
        )
        
        // When
        try sut.generateSchedule(for: testPlant, startDate: pastDate, periodDays: 1)
        let overdueSchedules = sut.getOverdueSchedules()
        
        // Then
        XCTAssertFalse(overdueSchedules.isEmpty)
        XCTAssertEqual(overdueSchedules[0].taskType, "WATERING")
        XCTAssertLessThan(overdueSchedules[0].dueDate, Date())
    }
    
    // MARK: - Concurrency Tests
    
    func testConcurrentScheduling() {
        // Given
        let concurrentExpectation = expectation(description: "Concurrent scheduling")
        concurrentExpectation.expectedFulfillmentCount = 5
        
        let startDate = Date()
        let scheduleGroup = DispatchGroup()
        
        // When
        for i in 0..<5 {
            scheduleGroup.enter()
            testQueue.async {
                do {
                    let schedules = try self.sut.generateSchedule(
                        for: self.testPlant,
                        startDate: startDate.addingTimeInterval(TimeInterval(i * 3600)),
                        periodDays: 7
                    )
                    
                    // Then
                    XCTAssertFalse(schedules.isEmpty)
                    concurrentExpectation.fulfill()
                    scheduleGroup.leave()
                } catch {
                    XCTFail("Concurrent scheduling failed: \(error)")
                    scheduleGroup.leave()
                }
            }
        }
        
        wait(for: [concurrentExpectation], timeout: 10.0)
    }
}

// MARK: - Mock Notification Scheduler

private class MockNotificationScheduler: NotificationScheduler {
    private(set) var scheduleNotificationCalled = false
    
    override func scheduleNotificationForTask(_ schedule: Schedule, enableRetry: Bool = true) -> Bool {
        scheduleNotificationCalled = true
        return true
    }
}