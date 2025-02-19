import XCTest // iOS 14.0+

@testable import GardenPlanner

class GardenPlannerUITests: XCTestCase {
    
    private var app: XCUIApplication!
    private let layoutGenerationTimeout: TimeInterval = 3.0
    
    override func setUp() {
        super.setUp()
        
        // Initialize application
        app = XCUIApplication()
        
        // Configure launch arguments for testing mode
        app.launchArguments = ["UI-Testing"]
        
        // Configure launch environment
        app.launchEnvironment = [
            "TESTING_MODE": "1",
            "DISABLE_ANIMATIONS": "1"
        ]
        
        // Launch the app
        app.launch()
    }
    
    override func tearDown() {
        app.terminate()
        super.tearDown()
    }
    
    func testGardenSetupFlow() throws {
        // Navigate to garden setup
        let gardenSetupButton = app.buttons["setupGardenButton"]
        XCTAssertTrue(waitForElement(gardenSetupButton, timeout: 5.0))
        gardenSetupButton.tap()
        
        // Test garden dimensions input
        let dimensionField = app.textFields["gardenDimensionField"]
        XCTAssertTrue(waitForElement(dimensionField, timeout: 2.0))
        dimensionField.tap()
        dimensionField.typeText("100")
        
        // Test sunlight condition selection
        let sunlightPicker = app.pickers["sunlightConditionPicker"]
        XCTAssertTrue(waitForElement(sunlightPicker, timeout: 2.0))
        sunlightPicker.tap()
        app.pickerWheels.element.adjust(toPickerWheelValue: "Full Sun")
        
        // Test vegetable requirements input
        let vegetableTable = app.tables["vegetableRequirementsTable"]
        XCTAssertTrue(waitForElement(vegetableTable, timeout: 2.0))
        
        // Add tomatoes
        app.buttons["addVegetableButton"].tap()
        let tomatoCell = vegetableTable.cells.element(boundBy: 0)
        tomatoCell.textFields["quantityField"].tap()
        tomatoCell.textFields["quantityField"].typeText("5")
        
        // Add lettuce
        app.buttons["addVegetableButton"].tap()
        let lettuceCell = vegetableTable.cells.element(boundBy: 1)
        lettuceCell.textFields["quantityField"].tap()
        lettuceCell.textFields["quantityField"].typeText("10")
        
        // Generate layout
        let optimizeButton = app.buttons["generateLayoutButton"]
        XCTAssertTrue(optimizeButton.isEnabled)
        optimizeButton.tap()
        
        // Verify layout generation
        let layoutView = app.otherElements["gardenLayoutView"]
        XCTAssertTrue(waitForElement(layoutView, timeout: layoutGenerationTimeout))
        
        // Verify layout elements
        XCTAssertTrue(app.staticTexts["spaceUtilizationLabel"].exists)
        XCTAssertTrue(app.staticTexts["estimatedYieldLabel"].exists)
        XCTAssertTrue(app.otherElements["plantLegend"].exists)
    }
    
    func testLayoutOptimization() throws {
        // Set up test data
        try testGardenSetupFlow()
        
        // Verify layout grid
        let layoutGrid = app.otherElements["layoutGrid"]
        XCTAssertTrue(waitForElement(layoutGrid, timeout: 2.0))
        
        // Verify plant placement
        let tomatoZones = layoutGrid.otherElements.matching(identifier: "plantZone-Tomato")
        let lettuceZones = layoutGrid.otherElements.matching(identifier: "plantZone-Lettuce")
        
        XCTAssertGreaterThan(tomatoZones.count, 0)
        XCTAssertGreaterThan(lettuceZones.count, 0)
        
        // Verify space utilization
        let utilizationLabel = app.staticTexts["spaceUtilizationLabel"]
        XCTAssertTrue(waitForElement(utilizationLabel, timeout: 1.0))
        let utilization = utilizationLabel.label
        XCTAssertTrue(utilization.contains("%"))
        
        // Test layout regeneration
        let regenerateButton = app.buttons["regenerateLayoutButton"]
        XCTAssertTrue(waitForElement(regenerateButton, timeout: 1.0))
        
        let startTime = Date()
        regenerateButton.tap()
        
        // Verify performance
        XCTAssertTrue(waitForElement(layoutGrid, timeout: layoutGenerationTimeout))
        let generationTime = Date().timeIntervalSince(startTime)
        XCTAssertLessThanOrEqual(generationTime, layoutGenerationTimeout)
    }
    
    func testInputValidation() throws {
        // Navigate to garden setup
        let gardenSetupButton = app.buttons["setupGardenButton"]
        XCTAssertTrue(waitForElement(gardenSetupButton, timeout: 5.0))
        gardenSetupButton.tap()
        
        let dimensionField = app.textFields["gardenDimensionField"]
        let optimizeButton = app.buttons["generateLayoutButton"]
        
        // Test invalid dimensions
        dimensionField.tap()
        dimensionField.typeText("0")
        XCTAssertTrue(app.staticTexts["dimensionErrorLabel"].exists)
        XCTAssertFalse(optimizeButton.isEnabled)
        
        dimensionField.tap()
        dimensionField.clearText()
        dimensionField.typeText("1001")
        XCTAssertTrue(app.staticTexts["dimensionErrorLabel"].exists)
        XCTAssertFalse(optimizeButton.isEnabled)
        
        // Test missing sunlight
        dimensionField.tap()
        dimensionField.clearText()
        dimensionField.typeText("100")
        XCTAssertFalse(optimizeButton.isEnabled)
        
        // Test invalid vegetable quantities
        let vegetableTable = app.tables["vegetableRequirementsTable"]
        app.buttons["addVegetableButton"].tap()
        
        let quantityField = vegetableTable.cells.element(boundBy: 0).textFields["quantityField"]
        quantityField.tap()
        quantityField.typeText("-1")
        XCTAssertTrue(app.staticTexts["quantityErrorLabel"].exists)
        XCTAssertFalse(optimizeButton.isEnabled)
        
        quantityField.tap()
        quantityField.clearText()
        quantityField.typeText("0")
        XCTAssertTrue(app.staticTexts["quantityErrorLabel"].exists)
        XCTAssertFalse(optimizeButton.isEnabled)
    }
    
    private func waitForElement(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "exists == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        return result == .completed
    }
}

// MARK: - XCUIElement Extensions
private extension XCUIElement {
    func clearText() {
        guard let stringValue = self.value as? String else { return }
        
        // iOS 13+ clear button
        let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: stringValue.count)
        typeText(deleteString)
    }
}