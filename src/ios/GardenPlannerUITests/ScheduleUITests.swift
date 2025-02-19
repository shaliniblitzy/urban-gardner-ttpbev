//
// ScheduleUITests.swift
// GardenPlannerUITests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest // iOS 14.0+
@testable import GardenPlanner

/// Comprehensive UI test suite for schedule management functionality with performance validation
/// and accessibility compliance testing.
@available(iOS 14.0, *)
final class ScheduleUITests: XCTestCase {
    
    // MARK: - Properties
    
    private var app: XCUIApplication!
    private var testDataProvider: TestDataProvider!
    private var asyncExpectation: XCTestExpectation!
    
    // Performance metrics
    private let maxLoadTime: TimeInterval = 3.0
    private let maxCompletionTime: TimeInterval = 1.0
    private let maxMemoryUsageMB: Double = 100.0
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize test environment
        app = XCUIApplication()
        app.launchArguments = ["UI_TESTING"]
        testDataProvider = TestDataProvider()
        
        // Configure performance monitoring
        continueAfterFailure = false
        
        // Launch app and navigate to schedule screen
        app.launch()
        navigateToScheduleScreen()
    }
    
    override func tearDown() {
        // Validate memory usage
        let memoryUsage = getMemoryUsage()
        XCTAssertLessThan(memoryUsage, maxMemoryUsageMB, "Memory usage exceeded limit")
        
        // Clean up test data
        testDataProvider.cleanUp()
        app.terminate()
        
        super.tearDown()
    }
    
    // MARK: - Test Cases
    
    /// Tests schedule list display, scrolling, and accessibility
    func testScheduleListDisplay() {
        // Measure initial load time
        measure(metrics: [XCTClockMetric()]) {
            let scheduleTable = app.tables["ScheduleTable"]
            XCTAssertTrue(scheduleTable.exists, "Schedule table not found")
            
            // Verify table load time
            let startTime = Date()
            let exists = scheduleTable.waitForExistence(timeout: maxLoadTime)
            let loadTime = Date().timeIntervalSince(startTime)
            
            XCTAssertTrue(exists, "Schedule table failed to load within \(maxLoadTime) seconds")
            XCTAssertLessThan(loadTime, maxLoadTime, "Schedule table load time exceeded limit")
        }
        
        // Test scrolling performance
        let scheduleTable = app.tables["ScheduleTable"]
        measure(metrics: [XCTScrollMetric()]) {
            scheduleTable.swipeUp(velocity: .fast)
            scheduleTable.swipeDown(velocity: .fast)
        }
        
        // Verify accessibility labels
        let cells = scheduleTable.cells
        XCTAssertGreaterThan(cells.count, 0, "No schedule cells found")
        
        cells.element(boundBy: 0).tap()
        XCTAssertTrue(cells.element(boundBy: 0).isSelected)
        
        // Test dynamic type support
        let currentSize = UIApplication.shared.preferredContentSizeCategory
        UIApplication.shared.preferredContentSizeCategory = .accessibilityExtraExtraExtraLarge
        XCTAssertTrue(scheduleTable.exists, "Table layout broken with larger text size")
        UIApplication.shared.preferredContentSizeCategory = currentSize
    }
    
    /// Tests schedule completion with error handling
    func testScheduleCompletion() {
        let scheduleTable = app.tables["ScheduleTable"]
        let firstCell = scheduleTable.cells.element(boundBy: 0)
        
        // Measure completion performance
        measure(metrics: [XCTClockMetric()]) {
            firstCell.tap()
            
            let completeButton = app.buttons["Complete"]
            XCTAssertTrue(completeButton.exists, "Complete button not found")
            
            let startTime = Date()
            completeButton.tap()
            
            // Verify completion animation
            let completionTime = Date().timeIntervalSince(startTime)
            XCTAssertLessThan(completionTime, maxCompletionTime, "Task completion exceeded time limit")
            
            // Verify completion state
            let checkmark = firstCell.images["checkmark.circle.fill"]
            XCTAssertTrue(checkmark.exists, "Completion checkmark not displayed")
        }
        
        // Test offline completion
        app.setSimulatedNetworkCondition(.offline)
        firstCell.tap()
        
        let errorAlert = app.alerts["ErrorAlert"]
        XCTAssertTrue(errorAlert.exists, "Error alert not displayed for offline completion")
        
        app.setSimulatedNetworkCondition(.online)
    }
    
    /// Tests notification preference controls
    func testNotificationPreferences() {
        let preferencesButton = app.buttons["NotificationPreferences"]
        XCTAssertTrue(preferencesButton.exists, "Preferences button not found")
        
        preferencesButton.tap()
        
        // Test preference toggles
        let pushToggle = app.switches["PushNotifications"]
        XCTAssertTrue(pushToggle.exists, "Push notification toggle not found")
        
        pushToggle.tap()
        XCTAssertEqual(pushToggle.value as? String, "1", "Push notifications not enabled")
        
        // Test time picker
        let timePicker = app.datePickers["ReminderTime"]
        XCTAssertTrue(timePicker.exists, "Time picker not found")
        
        timePicker.adjust(to: Date())
        
        // Verify persistence
        app.terminate()
        app.launch()
        navigateToScheduleScreen()
        preferencesButton.tap()
        
        XCTAssertEqual(pushToggle.value as? String, "1", "Preference not persisted")
    }
    
    /// Tests schedule filtering functionality
    func testFilterSchedules() {
        let filterControl = app.segmentedControls["FilterControl"]
        XCTAssertTrue(filterControl.exists, "Filter control not found")
        
        // Measure filter performance
        measure(metrics: [XCTClockMetric()]) {
            // Test all filters
            let filters = ["All", "Pending", "Completed"]
            
            for filter in filters {
                filterControl.buttons[filter].tap()
                
                let startTime = Date()
                let scheduleTable = app.tables["ScheduleTable"]
                let filterTime = Date().timeIntervalSince(startTime)
                
                XCTAssertLessThan(filterTime, maxLoadTime, "Filter operation exceeded time limit")
                XCTAssertTrue(scheduleTable.exists, "Table not updated after filtering")
            }
        }
        
        // Verify filter state persistence
        app.terminate()
        app.launch()
        navigateToScheduleScreen()
        
        XCTAssertEqual(filterControl.selectedSegmentIndex, 0, "Filter state not reset properly")
    }
    
    /// Tests overall schedule performance
    func testSchedulePerformance() {
        // Measure memory usage during intensive operations
        measure(metrics: [XCTMemoryMetric()]) {
            let scheduleTable = app.tables["ScheduleTable"]
            
            // Rapid scrolling
            for _ in 0..<10 {
                scheduleTable.swipeUp(velocity: .fast)
                scheduleTable.swipeDown(velocity: .fast)
            }
            
            // Rapid filtering
            let filterControl = app.segmentedControls["FilterControl"]
            for _ in 0..<5 {
                filterControl.buttons["Pending"].tap()
                filterControl.buttons["Completed"].tap()
                filterControl.buttons["All"].tap()
            }
        }
        
        // Verify responsiveness
        let scheduleTable = app.tables["ScheduleTable"]
        XCTAssertTrue(scheduleTable.exists && scheduleTable.isHittable,
                     "Table became unresponsive after intensive operations")
    }
    
    /// Tests accessibility compliance
    func testAccessibilityCompliance() {
        // Test VoiceOver navigation
        XCUIDevice.shared.press(.home)
        
        let scheduleTable = app.tables["ScheduleTable"]
        let cells = scheduleTable.cells
        
        for i in 0..<min(cells.count, 5) {
            let cell = cells.element(boundBy: i)
            XCTAssertTrue(cell.isAccessibilityElement, "Cell \(i) not accessible")
            XCTAssertNotNil(cell.label, "Cell \(i) missing accessibility label")
        }
        
        // Test keyboard navigation
        app.typeKey(.tab, modifierFlags: [])
        XCTAssertTrue(cells.element(boundBy: 0).isSelected,
                     "Keyboard navigation not working")
        
        // Verify color contrast
        let backgroundColors = scheduleTable.otherElements.colors
        for color in backgroundColors {
            XCTAssertTrue(color.contrastRatio >= 4.5,
                         "Insufficient color contrast for accessibility")
        }
    }
    
    // MARK: - Helper Methods
    
    private func navigateToScheduleScreen() {
        let scheduleTab = app.tabBars.buttons["Schedule"]
        XCTAssertTrue(scheduleTab.waitForExistence(timeout: 5.0))
        scheduleTab.tap()
    }
    
    private func getMemoryUsage() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }
        
        XCTAssertEqual(kerr, KERN_SUCCESS)
        return Double(info.resident_size) / 1024.0 / 1024.0
    }
}