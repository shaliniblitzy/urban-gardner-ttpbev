import XCTest

/// UI test suite for verifying Settings screen functionality including notification preferences,
/// measurement units, and general UI responsiveness
class SettingsUITests: XCTestCase {
    
    // MARK: - Properties
    
    /// Main application instance used for testing
    private var app: XCUIApplication!
    
    /// Maximum allowed response time for UI interactions (in seconds)
    private let maxResponseTime: TimeInterval = 3.0
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        
        // Initialize and configure the application
        app = XCUIApplication()
        app.launch()
        
        // Navigate to Settings screen
        let settingsButton = app.buttons["settingsButton"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: maxResponseTime))
        settingsButton.tap()
    }
    
    override func tearDown() {
        app.terminate()
        super.tearDown()
    }
    
    // MARK: - Test Cases
    
    func testNotificationTypeSelection() {
        // Verify segment control exists
        let notificationTypeSegment = app.segmentedControls["notificationTypeSegment"]
        XCTAssertTrue(notificationTypeSegment.waitForExistence(timeout: maxResponseTime))
        
        // Test segment control accessibility
        XCTAssertTrue(notificationTypeSegment.isEnabled)
        XCTAssertNotNil(notificationTypeSegment.value)
        
        // Test each segment option
        let segments = ["Daily", "Weekly", "Monthly"]
        for segment in segments {
            let startTime = Date()
            
            notificationTypeSegment.buttons[segment].tap()
            
            // Verify response time
            let responseTime = Date().timeIntervalSince(startTime)
            XCTAssertLessThan(responseTime, maxResponseTime)
            
            // Verify selection
            XCTAssertEqual(notificationTypeSegment.selectedSegmentIndex, segments.firstIndex(of: segment))
            
            // Verify persistence
            let selectedValue = app.segmentedControls["notificationTypeSegment"].value as? String
            XCTAssertEqual(selectedValue, segment)
        }
    }
    
    func testReminderTimePicker() {
        // Verify time picker exists
        let timePicker = app.datePickers["reminderTimePicker"]
        XCTAssertTrue(timePicker.waitForExistence(timeout: maxResponseTime))
        
        // Test accessibility
        XCTAssertTrue(timePicker.isEnabled)
        XCTAssertNotNil(timePicker.value)
        
        // Test time selection
        let testTimes = ["09:00 AM", "02:30 PM", "08:00 PM"]
        for time in testTimes {
            let startTime = Date()
            
            // Set time using picker
            timePicker.adjust(toPickerWheelValue: time)
            
            // Verify response time
            let responseTime = Date().timeIntervalSince(startTime)
            XCTAssertLessThan(responseTime, maxResponseTime)
            
            // Verify selection and persistence
            let selectedTime = timePicker.value as? String
            XCTAssertEqual(selectedTime, time)
        }
    }
    
    func testNotificationSwitches() {
        // Verify switches exist
        let pushSwitch = app.switches["pushNotificationSwitch"]
        let emailSwitch = app.switches["emailNotificationSwitch"]
        
        XCTAssertTrue(pushSwitch.waitForExistence(timeout: maxResponseTime))
        XCTAssertTrue(emailSwitch.waitForExistence(timeout: maxResponseTime))
        
        // Test accessibility
        XCTAssertTrue(pushSwitch.isEnabled)
        XCTAssertTrue(emailSwitch.isEnabled)
        XCTAssertNotNil(pushSwitch.value)
        XCTAssertNotNil(emailSwitch.value)
        
        // Test switch interactions
        for `switch` in [pushSwitch, emailSwitch] {
            let startState = `switch`.value as? String
            let startTime = Date()
            
            // Toggle switch
            `switch`.tap()
            
            // Verify response time
            let responseTime = Date().timeIntervalSince(startTime)
            XCTAssertLessThan(responseTime, maxResponseTime)
            
            // Verify state change
            let newState = `switch`.value as? String
            XCTAssertNotEqual(startState, newState)
            
            // Verify persistence
            XCTAssertEqual(`switch`.value as? String, newState)
        }
    }
    
    func testMeasurementUnitSelection() {
        // Verify unit selector exists
        let unitSegment = app.segmentedControls["measurementUnitSegment"]
        XCTAssertTrue(unitSegment.waitForExistence(timeout: maxResponseTime))
        
        // Test accessibility
        XCTAssertTrue(unitSegment.isEnabled)
        XCTAssertNotNil(unitSegment.value)
        
        // Test unit selection
        let units = ["Metric", "Imperial"]
        for unit in units {
            let startTime = Date()
            
            unitSegment.buttons[unit].tap()
            
            // Verify response time
            let responseTime = Date().timeIntervalSince(startTime)
            XCTAssertLessThan(responseTime, maxResponseTime)
            
            // Verify selection
            XCTAssertEqual(unitSegment.selectedSegmentIndex, units.firstIndex(of: unit))
            
            // Verify persistence and formatting
            let selectedUnit = app.segmentedControls["measurementUnitSegment"].value as? String
            XCTAssertEqual(selectedUnit, unit)
            
            // Verify unit display updates
            let areaLabel = app.staticTexts["areaUnitLabel"]
            let expectedUnit = unit == "Metric" ? "m²" : "sq ft"
            XCTAssertEqual(areaLabel.label, expectedUnit)
        }
    }
}