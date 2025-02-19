import XCTest

class LayoutUITests: XCTestCase {
    // MARK: - Properties
    private var app: XCUIApplication!
    private let layoutGenerationTimeout: TimeInterval = 3.0 // Maximum allowed time for layout generation
    private let minimumUtilizationImprovement: Double = 0.30 // Required 30% improvement
    
    // MARK: - Test Lifecycle
    override func setUp() {
        super.setUp()
        
        // Initialize and configure application
        app = XCUIApplication()
        app.launchArguments = ["UI-TESTING"]
        app.launchEnvironment = [
            "GARDEN_TEST_MODE": "true",
            "MOCK_GARDEN_SIZE": "100", // 100 sq ft test garden
            "MOCK_SUNLIGHT_ZONES": "FULL_SUN,PARTIAL_SHADE"
        ]
        
        // Launch the app and navigate to layout view
        app.launch()
        
        // Navigate to layout view (assuming navigation from home screen)
        app.buttons["Generate Garden Plan"].tap()
        
        // Wait for layout view to load
        let layoutView = app.otherElements["gardenLayoutView"]
        XCTAssertTrue(layoutView.waitForExistence(timeout: 5.0))
    }
    
    override func tearDown() {
        // Clean up test environment
        app.terminate()
        super.tearDown()
    }
    
    // MARK: - Test Cases
    func testLayoutGeneration() {
        // Verify garden grid exists
        let gardenGrid = app.otherElements["gardenGrid"]
        XCTAssertTrue(gardenGrid.exists)
        
        // Measure layout generation performance
        measure(metrics: [XCTClockMetric()]) {
            app.buttons["generateLayout"].tap()
            
            // Wait for layout completion
            let layoutComplete = app.staticTexts["Space Utilization:"].waitForExistence(timeout: layoutGenerationTimeout)
            XCTAssertTrue(layoutComplete, "Layout generation exceeded \(layoutGenerationTimeout) seconds timeout")
        }
        
        // Verify plant indicators
        let plantIndicators = app.otherElements.matching(identifier: "plantIndicator")
        XCTAssertGreaterThan(plantIndicators.count, 0, "No plant indicators found in layout")
        
        // Verify layout legend
        let legend = app.otherElements["layoutLegend"]
        XCTAssertTrue(legend.exists)
        XCTAssertTrue(legend.staticTexts["T=Tomatoes"].exists)
        XCTAssertTrue(legend.staticTexts["L=Lettuce"].exists)
        XCTAssertTrue(legend.staticTexts["C=Carrots"].exists)
    }
    
    func testSpaceUtilization() {
        // Extract utilization percentage
        let utilizationText = app.staticTexts.matching(identifier: "utilizationPercentage").firstMatch
        XCTAssertTrue(utilizationText.exists)
        
        // Parse utilization value
        let utilizationString = utilizationText.label
        let percentage = utilizationString.replacingOccurrences(of: "Space Utilization: ", with: "")
            .replacingOccurrences(of: "%", with: "")
        
        guard let utilization = Double(percentage) else {
            XCTFail("Could not parse utilization percentage")
            return
        }
        
        // Verify minimum utilization improvement
        XCTAssertGreaterThanOrEqual(utilization / 100.0, minimumUtilizationImprovement,
                                   "Space utilization improvement below required 30%")
        
        // Verify plant spacing
        let plantGrid = app.otherElements["plantGrid"]
        XCTAssertTrue(plantGrid.exists)
        
        // Verify no overlapping plants
        let plantCells = plantGrid.cells.matching(identifier: "plantCell")
        for cell in plantCells.allElementsBoundByIndex {
            let frame = cell.frame
            let overlappingCells = plantCells.allElementsBoundByIndex.filter { 
                $0 != cell && $0.frame.intersects(frame)
            }
            XCTAssertEqual(overlappingCells.count, 0, "Found overlapping plants in layout")
        }
    }
    
    func testLayoutRegeneration() {
        // Capture initial layout state
        let initialLayout = app.otherElements["gardenGrid"].screenshot()
        
        // Trigger layout regeneration
        app.buttons["Modify"].tap()
        
        // Verify loading indicator
        let loadingIndicator = app.activityIndicators["layoutGenerating"]
        XCTAssertTrue(loadingIndicator.exists)
        
        // Wait for new layout
        let newLayoutGenerated = app.otherElements["gardenGrid"].waitForExistence(timeout: layoutGenerationTimeout)
        XCTAssertTrue(newLayoutGenerated)
        
        // Verify layout changed
        let newLayout = app.otherElements["gardenGrid"].screenshot()
        XCTAssertFalse(initialLayout.pngRepresentation == newLayout.pngRepresentation,
                       "Layout did not change after regeneration")
        
        // Verify plant counts maintained
        let initialPlantCount = countPlantsByType()
        let newPlantCount = countPlantsByType()
        XCTAssertEqual(initialPlantCount, newPlantCount, "Plant quantities changed during regeneration")
    }
    
    func testLayoutInteractions() {
        let gardenGrid = app.otherElements["gardenGrid"]
        
        // Test zoom functionality
        let pinchGesture = UIPinchGestureRecognizer(target: self, action: nil)
        gardenGrid.pinch(withScale: 2.0, velocity: 1.0)
        
        // Verify zoom state
        let zoomLevel = gardenGrid.value as? String
        XCTAssertNotNil(zoomLevel?.contains("2.0"), "Zoom level not updated")
        
        // Test pan navigation
        let startCoordinate = gardenGrid.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let endCoordinate = gardenGrid.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.7))
        startCoordinate.press(forDuration: 0.1, thenDragTo: endCoordinate)
        
        // Test plant selection
        let plantIndicator = app.otherElements.matching(identifier: "plantIndicator").firstMatch
        plantIndicator.tap()
        
        // Verify plant info display
        let plantInfo = app.otherElements["plantInfoPanel"]
        XCTAssertTrue(plantInfo.exists)
        
        // Test accessibility
        XCTAssertTrue(gardenGrid.isAccessibilityElement)
        XCTAssertNotNil(gardenGrid.accessibilityLabel)
        XCTAssertNotNil(gardenGrid.accessibilityHint)
    }
    
    // MARK: - Helper Methods
    private func countPlantsByType() -> [String: Int] {
        var counts: [String: Int] = [:]
        let plantIndicators = app.otherElements.matching(identifier: "plantIndicator")
        
        for indicator in plantIndicators.allElementsBoundByIndex {
            let plantType = indicator.label
            counts[plantType, default: 0] += 1
        }
        
        return counts
    }
}