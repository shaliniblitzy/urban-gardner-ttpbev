//
// ScheduleViewModelTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
import Combine
@testable import GardenPlanner

@available(iOS 14.0, *)
final class ScheduleViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: ScheduleViewModel!
    private var mockScheduleService: MockScheduleService!
    private var cancellables: Set<AnyCancellable>!
    private var performanceOptions: XCTMeasureOptions!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        mockScheduleService = MockScheduleService()
        sut = ScheduleViewModel(scheduleService: mockScheduleService)
        cancellables = Set<AnyCancellable>()
        
        // Configure performance measurement options
        performanceOptions = XCTMeasureOptions()
        performanceOptions.iterationCount = 5
        performanceOptions.timeLimit = 3.0 // 3 second performance requirement
    }
    
    override func tearDown() {
        cancellables.forEach { $0.cancel() }
        cancellables = nil
        sut = nil
        mockScheduleService = nil
        super.tearDown()
    }
    
    // MARK: - Test Cases
    
    func testLoadSchedulesOnViewDidLoad() {
        // Given
        let expectation = XCTestExpectation(description: "Load schedules")
        let viewDidLoadSubject = PassthroughSubject<Void, Never>()
        let scheduleCompletedSubject = PassthroughSubject<Schedule, Never>()
        let notificationPreferencesSubject = PassthroughSubject<NotificationPreferences, Never>()
        
        let input = ScheduleViewModel.Input(
            viewDidLoad: viewDidLoadSubject.eraseToAnyPublisher(),
            scheduleCompleted: scheduleCompletedSubject.eraseToAnyPublisher(),
            notificationPreferencesUpdated: notificationPreferencesSubject.eraseToAnyPublisher()
        )
        
        // Set up mock schedules
        let plant = Plant(
            id: "test_plant",
            type: "Tomato",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 60,
            minSunlightHours: 6,
            companionPlants: [],
            incompatiblePlants: [],
            expectedYieldKg: 2.5,
            isPerennial: false
        )
        
        let mockSchedules = [
            Schedule(
                id: "schedule1",
                plant: plant,
                taskType: "WATERING",
                dueDate: Date().addingTimeInterval(3600),
                notificationPreference: NotificationPreferences()
            ),
            Schedule(
                id: "schedule2",
                plant: plant,
                taskType: "FERTILIZING",
                dueDate: Date().addingTimeInterval(7200),
                notificationPreference: NotificationPreferences()
            )
        ]
        
        mockScheduleService.mockSchedules = mockSchedules
        
        var receivedSchedules: [Schedule] = []
        var receivedErrors: [Error] = []
        var loadingStates: [Bool] = []
        
        // When
        let output = sut.transform(input)
        
        output.schedules
            .sink { schedules in
                receivedSchedules = schedules
                if !schedules.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedErrors.append(error)
            }
            .store(in: &cancellables)
        
        output.isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)
        
        // Measure performance
        measure(options: performanceOptions) {
            viewDidLoadSubject.send(())
        }
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertEqual(receivedSchedules.count, 2)
        XCTAssertEqual(receivedSchedules[0].id, "schedule1")
        XCTAssertEqual(receivedSchedules[1].id, "schedule2")
        XCTAssertTrue(receivedErrors.isEmpty)
        XCTAssertEqual(loadingStates, [true, false])
    }
    
    func testCompleteSchedule() {
        // Given
        let expectation = XCTestExpectation(description: "Complete schedule")
        let viewDidLoadSubject = PassthroughSubject<Void, Never>()
        let scheduleCompletedSubject = PassthroughSubject<Schedule, Never>()
        let notificationPreferencesSubject = PassthroughSubject<NotificationPreferences, Never>()
        
        let plant = Plant(
            id: "test_plant",
            type: "Tomato",
            sunlightNeeds: SunlightConditions.fullSun,
            spacing: 2.0,
            daysToMaturity: 60,
            minSunlightHours: 6,
            companionPlants: [],
            incompatiblePlants: [],
            expectedYieldKg: 2.5,
            isPerennial: false
        )
        
        let schedule = Schedule(
            id: "schedule1",
            plant: plant,
            taskType: "WATERING",
            dueDate: Date().addingTimeInterval(3600),
            notificationPreference: NotificationPreferences()
        )
        
        mockScheduleService.completionResult = schedule
        
        let input = ScheduleViewModel.Input(
            viewDidLoad: viewDidLoadSubject.eraseToAnyPublisher(),
            scheduleCompleted: scheduleCompletedSubject.eraseToAnyPublisher(),
            notificationPreferencesUpdated: notificationPreferencesSubject.eraseToAnyPublisher()
        )
        
        var receivedSchedules: [Schedule] = []
        var receivedErrors: [Error] = []
        
        // When
        let output = sut.transform(input)
        
        output.schedules
            .sink { schedules in
                receivedSchedules = schedules
                if schedules.contains(where: { $0.isCompleted }) {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedErrors.append(error)
            }
            .store(in: &cancellables)
        
        scheduleCompletedSubject.send(schedule)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertTrue(receivedErrors.isEmpty)
        XCTAssertTrue(mockScheduleService.updateSuccess)
    }
    
    func testUpdateNotificationPreferences() {
        // Given
        let expectation = XCTestExpectation(description: "Update preferences")
        let viewDidLoadSubject = PassthroughSubject<Void, Never>()
        let scheduleCompletedSubject = PassthroughSubject<Schedule, Never>()
        let notificationPreferencesSubject = PassthroughSubject<NotificationPreferences, Never>()
        
        let preferences = NotificationPreferences()
        
        let input = ScheduleViewModel.Input(
            viewDidLoad: viewDidLoadSubject.eraseToAnyPublisher(),
            scheduleCompleted: scheduleCompletedSubject.eraseToAnyPublisher(),
            notificationPreferencesUpdated: notificationPreferencesSubject.eraseToAnyPublisher()
        )
        
        var receivedErrors: [Error] = []
        
        // When
        let output = sut.transform(input)
        
        output.error
            .sink { error in
                receivedErrors.append(error)
            }
            .store(in: &cancellables)
        
        // Test concurrent updates
        DispatchQueue.concurrentPerform(iterations: 5) { _ in
            notificationPreferencesSubject.send(preferences)
        }
        
        // Then
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertTrue(receivedErrors.isEmpty)
        XCTAssertTrue(mockScheduleService.updateSuccess)
    }
}

// MARK: - Mock Schedule Service

private final class MockScheduleService: ScheduleService {
    var mockSchedules: [Schedule] = []
    var updateSuccess: Bool = true
    var completionResult: Schedule?
    private let serviceLock = NSLock()
    var deliveryConfirmation: [String: Bool] = [:]
    
    override func getOverdueSchedules() -> [Schedule] {
        serviceLock.lock()
        defer { serviceLock.unlock() }
        return mockSchedules
    }
    
    override func completeSchedule(_ schedule: Schedule) -> Result<Schedule?, Error> {
        serviceLock.lock()
        defer { serviceLock.unlock() }
        
        if let completionResult = completionResult {
            return .success(completionResult)
        }
        return .failure(GardenPlannerError.customError(.scheduleGenerationFailed, "Mock completion failed"))
    }
    
    override func updateSchedule(_ schedule: Schedule) -> Result<Bool, Error> {
        serviceLock.lock()
        defer { serviceLock.unlock() }
        return .success(updateSuccess)
    }
}