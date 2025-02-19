//
// NotificationServiceTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
@testable import GardenPlanner

final class NotificationServiceTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: NotificationService!
    private var testSchedule: Schedule!
    private var testPlant: Plant!
    private let timeout: TimeInterval = 1.0
    private let deliveryTimeout: TimeInterval = 3.0
    
    // Test tracking
    private var deliveryExpectation: XCTestExpectation!
    private var completionExpectation: XCTestExpectation!
    private var notificationCount: Int = 0
    private let notificationCountLock = NSLock()
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Create test plant
        testPlant = Plant(
            id: "test_plant_1",
            type: "Tomato",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 60,
            minSunlightHours: 6,
            companionPlants: ["Basil"],
            incompatiblePlants: ["Potato"],
            expectedYieldKg: 3.5,
            isPerennial: false
        )
        
        // Create test schedule
        testSchedule = Schedule(
            id: "test_schedule_1",
            plant: testPlant,
            taskType: "WATERING",
            dueDate: Date().addingTimeInterval(3600),
            notificationPreference: .immediate
        )
        
        // Initialize notification service
        sut = NotificationService()
        
        // Reset notification tracking
        notificationCount = 0
        
        // Add observer for delivery confirmations
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNotificationDelivered(_:)),
            name: NSNotification.Name("NotificationDeliveredNotification"),
            object: nil
        )
    }
    
    override func tearDown() {
        // Cancel any pending notifications
        NotificationCenter.default.removeObserver(self)
        sut = nil
        testSchedule = nil
        testPlant = nil
        super.tearDown()
    }
    
    // MARK: - Setup Tests
    
    func testSetupNotificationsWithPerformance() {
        // Given
        let setupExpectation = expectation(description: "Setup completed")
        
        // When
        measure {
            sut.setupNotifications { result in
                switch result {
                case .success(let granted):
                    XCTAssertTrue(granted, "Notification authorization should be granted")
                case .failure(let error):
                    XCTFail("Setup failed with error: \(error.localizedDescription)")
                }
                setupExpectation.fulfill()
            }
        }
        
        // Then
        wait(for: [setupExpectation], timeout: timeout)
    }
    
    // MARK: - Scheduling Tests
    
    func testScheduleNotificationThreadSafety() {
        // Given
        let concurrentSchedules = 10
        var schedules: [Schedule] = []
        let schedulingGroup = DispatchGroup()
        
        // Create multiple test schedules
        for i in 0..<concurrentSchedules {
            let schedule = Schedule(
                id: "test_schedule_\(i)",
                plant: testPlant,
                taskType: "WATERING",
                dueDate: Date().addingTimeInterval(Double(i + 1) * 3600),
                notificationPreference: .immediate
            )
            schedules.append(schedule)
        }
        
        // When
        measure {
            schedules.forEach { schedule in
                schedulingGroup.enter()
                DispatchQueue.global().async {
                    self.sut.scheduleNotification(schedule) { result in
                        switch result {
                        case .success:
                            self.incrementNotificationCount()
                        case .failure(let error):
                            XCTFail("Scheduling failed with error: \(error.localizedDescription)")
                        }
                        schedulingGroup.leave()
                    }
                }
            }
        }
        
        // Then
        let result = schedulingGroup.wait(timeout: .now() + deliveryTimeout)
        XCTAssertEqual(.success, result, "All notifications should be scheduled within timeout")
        XCTAssertEqual(concurrentSchedules, notificationCount, "All notifications should be scheduled")
    }
    
    func testNotificationDeliveryTiming() {
        // Given
        deliveryExpectation = expectation(description: "Notification delivered")
        completionExpectation = expectation(description: "Scheduling completed")
        
        // When
        let startTime = Date()
        sut.scheduleNotification(testSchedule) { result in
            switch result {
            case .success:
                self.completionExpectation.fulfill()
            case .failure(let error):
                XCTFail("Scheduling failed with error: \(error.localizedDescription)")
            }
        }
        
        // Then
        wait(for: [completionExpectation, deliveryExpectation], timeout: deliveryTimeout)
        let deliveryTime = Date().timeIntervalSince(startTime)
        XCTAssertLessThanOrEqual(deliveryTime, timeout, "Notification should be delivered within timeout")
    }
    
    func testErrorHandlingAndRecovery() {
        // Given
        let invalidSchedule = Schedule(
            id: "invalid_schedule",
            plant: testPlant,
            taskType: "INVALID",
            dueDate: Date().addingTimeInterval(-3600), // Past due date
            notificationPreference: .immediate
        )
        
        completionExpectation = expectation(description: "Error handling completed")
        
        // When
        sut.scheduleNotification(invalidSchedule) { result in
            switch result {
            case .success:
                XCTFail("Should fail with invalid schedule")
            case .failure(let error):
                // Then
                XCTAssertEqual(error.code, .scheduleGenerationFailed, "Should fail with schedule generation error")
                self.completionExpectation.fulfill()
            }
        }
        
        wait(for: [completionExpectation], timeout: timeout)
    }
    
    func testUpdateNotificationWithValidSchedule() {
        // Given
        let updateExpectation = expectation(description: "Update completed")
        
        // Schedule initial notification
        sut.scheduleNotification(testSchedule) { result in
            guard case .success = result else {
                XCTFail("Initial scheduling failed")
                return
            }
            
            // When - Update the schedule
            self.testSchedule.updateReminderTime(Date().addingTimeInterval(7200))
            self.sut.updateNotification(self.testSchedule) { updateResult in
                switch updateResult {
                case .success:
                    updateExpectation.fulfill()
                case .failure(let error):
                    XCTFail("Update failed with error: \(error.localizedDescription)")
                }
            }
        }
        
        // Then
        wait(for: [updateExpectation], timeout: timeout)
    }
    
    func testHandleNotificationResponse() {
        // Given
        let responseExpectation = expectation(description: "Response handled")
        
        // When
        sut.handleNotificationResponse(
            scheduleId: testSchedule.id,
            actionIdentifier: "COMPLETE_TASK"
        ) { result in
            switch result {
            case .success:
                XCTAssertTrue(self.testSchedule.isCompleted, "Schedule should be marked as completed")
                responseExpectation.fulfill()
            case .failure(let error):
                XCTFail("Response handling failed with error: \(error.localizedDescription)")
            }
        }
        
        // Then
        wait(for: [responseExpectation], timeout: timeout)
    }
    
    // MARK: - Helper Methods
    
    @objc private func handleNotificationDelivered(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let success = userInfo["success"] as? Bool,
              success else {
            return
        }
        deliveryExpectation?.fulfill()
    }
    
    private func incrementNotificationCount() {
        notificationCountLock.lock()
        defer { notificationCountLock.unlock() }
        notificationCount += 1
    }
}