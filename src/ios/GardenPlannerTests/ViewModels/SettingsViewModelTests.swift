import XCTest
import Combine
@testable import GardenPlanner

final class MockUserPreferencesService: UserPreferencesService {
    var preferencesPublisher = CurrentValueSubject<UserPreferences, Never>(
        UserPreferences(
            notificationPreference: .daily,
            reminderTime: "09:00",
            areaUnit: .squareFeet,
            waterUnit: .liters,
            pushNotificationsEnabled: true,
            emailNotificationsEnabled: false
        )
    )
    
    var updateNotificationPreferencesCalled = false
    var updateMeasurementUnitsCalled = false
    var mockError: GardenPlannerError?
    private let serialQueue = DispatchQueue(label: "com.gardenplanner.mock.queue")
    
    override func updateNotificationPreferences(
        preference: NotificationPreference,
        reminderTime: String,
        pushEnabled: Bool,
        emailEnabled: Bool
    ) -> Result<Void, GardenPlannerError> {
        serialQueue.sync {
            updateNotificationPreferencesCalled = true
            
            if let error = mockError {
                return .failure(error)
            }
            
            let currentPrefs = preferencesPublisher.value
            let newPrefs = UserPreferences(
                notificationPreference: preference,
                reminderTime: reminderTime,
                areaUnit: currentPrefs.areaUnit,
                waterUnit: currentPrefs.waterUnit,
                pushNotificationsEnabled: pushEnabled,
                emailNotificationsEnabled: emailEnabled
            )
            preferencesPublisher.send(newPrefs)
            return .success(())
        }
    }
    
    override func savePreferences(_ preferences: UserPreferences) -> Result<Void, GardenPlannerError> {
        serialQueue.sync {
            updateMeasurementUnitsCalled = true
            
            if let error = mockError {
                return .failure(error)
            }
            
            preferencesPublisher.send(preferences)
            return .success(())
        }
    }
}

@available(iOS 14.0, *)
final class SettingsViewModelTests: XCTestCase {
    private var sut: SettingsViewModel!
    private var mockPreferencesService: MockUserPreferencesService!
    private var cancellables: Set<AnyCancellable>!
    private let testQueue = DispatchQueue(label: "com.gardenplanner.test.queue")
    
    override func setUp() {
        super.setUp()
        mockPreferencesService = MockUserPreferencesService()
        sut = SettingsViewModel(preferencesService: mockPreferencesService)
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        cancellables.forEach { $0.cancel() }
        cancellables = nil
        sut = nil
        mockPreferencesService = nil
        super.tearDown()
    }
    
    func testUpdateNotificationPreferences_Success() {
        // Given
        let expectation = expectation(description: "Notification preferences updated")
        let reminderTime = "10:00"
        let notificationPreference = NotificationPreference.weekly
        
        let notificationTimeSubject = PassthroughSubject<String, Never>()
        let notificationPrefSubject = PassthroughSubject<NotificationPreference, Never>()
        let pushNotificationsSubject = PassthroughSubject<Bool, Never>()
        let emailNotificationsSubject = PassthroughSubject<Bool, Never>()
        let areaUnitSubject = PassthroughSubject<MeasurementUnit, Never>()
        let waterUnitSubject = PassthroughSubject<MeasurementUnit, Never>()
        let requestPermissionSubject = PassthroughSubject<Void, Never>()
        
        let input = SettingsViewModel.Input(
            updateNotificationTime: notificationTimeSubject.eraseToAnyPublisher(),
            updateNotificationPreference: notificationPrefSubject.eraseToAnyPublisher(),
            togglePushNotifications: pushNotificationsSubject.eraseToAnyPublisher(),
            toggleEmailNotifications: emailNotificationsSubject.eraseToAnyPublisher(),
            updateAreaUnit: areaUnitSubject.eraseToAnyPublisher(),
            updateWaterUnit: waterUnitSubject.eraseToAnyPublisher(),
            requestNotificationPermission: requestPermissionSubject.eraseToAnyPublisher()
        )
        
        let output = sut.transform(input)
        
        // When
        var receivedPreferences: UserPreferences?
        var receivedError: GardenPlannerError?
        
        output.preferences
            .sink { preferences in
                receivedPreferences = preferences
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedError = error
                XCTFail("Unexpected error: \(error.localizedDescription)")
            }
            .store(in: &cancellables)
        
        let startTime = CFAbsoluteTimeGetCurrent()
        
        notificationTimeSubject.send(reminderTime)
        notificationPrefSubject.send(notificationPreference)
        
        // Verify completion within performance requirements
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }
        
        waitForExpectations(timeout: 3) { error in
            XCTAssertNil(error)
            
            // Then
            XCTAssertTrue(self.mockPreferencesService.updateNotificationPreferencesCalled)
            XCTAssertEqual(receivedPreferences?.reminderTime, reminderTime)
            XCTAssertEqual(receivedPreferences?.notificationPreference, notificationPreference)
            XCTAssertNil(receivedError)
            
            let endTime = CFAbsoluteTimeGetCurrent()
            XCTAssertLessThan(endTime - startTime, 3.0, "Operation exceeded performance requirement")
        }
    }
    
    func testUpdateMeasurementUnits_Success() {
        // Given
        let expectation = expectation(description: "Measurement units updated")
        let areaUnit = MeasurementUnit.squareMeters
        let waterUnit = MeasurementUnit.gallons
        
        let notificationTimeSubject = PassthroughSubject<String, Never>()
        let notificationPrefSubject = PassthroughSubject<NotificationPreference, Never>()
        let pushNotificationsSubject = PassthroughSubject<Bool, Never>()
        let emailNotificationsSubject = PassthroughSubject<Bool, Never>()
        let areaUnitSubject = PassthroughSubject<MeasurementUnit, Never>()
        let waterUnitSubject = PassthroughSubject<MeasurementUnit, Never>()
        let requestPermissionSubject = PassthroughSubject<Void, Never>()
        
        let input = SettingsViewModel.Input(
            updateNotificationTime: notificationTimeSubject.eraseToAnyPublisher(),
            updateNotificationPreference: notificationPrefSubject.eraseToAnyPublisher(),
            togglePushNotifications: pushNotificationsSubject.eraseToAnyPublisher(),
            toggleEmailNotifications: emailNotificationsSubject.eraseToAnyPublisher(),
            updateAreaUnit: areaUnitSubject.eraseToAnyPublisher(),
            updateWaterUnit: waterUnitSubject.eraseToAnyPublisher(),
            requestNotificationPermission: requestPermissionSubject.eraseToAnyPublisher()
        )
        
        let output = sut.transform(input)
        
        // When
        var receivedPreferences: UserPreferences?
        var receivedError: GardenPlannerError?
        
        output.preferences
            .sink { preferences in
                receivedPreferences = preferences
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedError = error
                XCTFail("Unexpected error: \(error.localizedDescription)")
            }
            .store(in: &cancellables)
        
        let startTime = CFAbsoluteTimeGetCurrent()
        
        areaUnitSubject.send(areaUnit)
        waterUnitSubject.send(waterUnit)
        
        // Verify completion within performance requirements
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }
        
        waitForExpectations(timeout: 3) { error in
            XCTAssertNil(error)
            
            // Then
            XCTAssertTrue(self.mockPreferencesService.updateMeasurementUnitsCalled)
            XCTAssertEqual(receivedPreferences?.areaUnit, areaUnit)
            XCTAssertEqual(receivedPreferences?.waterUnit, waterUnit)
            XCTAssertNil(receivedError)
            
            let endTime = CFAbsoluteTimeGetCurrent()
            XCTAssertLessThan(endTime - startTime, 3.0, "Operation exceeded performance requirement")
        }
    }
    
    func testConcurrentPreferenceUpdates() {
        // Given
        let expectation = expectation(description: "Concurrent updates completed")
        expectation.expectedFulfillmentCount = 3
        
        let notificationTimeSubject = PassthroughSubject<String, Never>()
        let notificationPrefSubject = PassthroughSubject<NotificationPreference, Never>()
        let pushNotificationsSubject = PassthroughSubject<Bool, Never>()
        let emailNotificationsSubject = PassthroughSubject<Bool, Never>()
        let areaUnitSubject = PassthroughSubject<MeasurementUnit, Never>()
        let waterUnitSubject = PassthroughSubject<MeasurementUnit, Never>()
        let requestPermissionSubject = PassthroughSubject<Void, Never>()
        
        let input = SettingsViewModel.Input(
            updateNotificationTime: notificationTimeSubject.eraseToAnyPublisher(),
            updateNotificationPreference: notificationPrefSubject.eraseToAnyPublisher(),
            togglePushNotifications: pushNotificationsSubject.eraseToAnyPublisher(),
            toggleEmailNotifications: emailNotificationsSubject.eraseToAnyPublisher(),
            updateAreaUnit: areaUnitSubject.eraseToAnyPublisher(),
            updateWaterUnit: waterUnitSubject.eraseToAnyPublisher(),
            requestNotificationPermission: requestPermissionSubject.eraseToAnyPublisher()
        )
        
        let output = sut.transform(input)
        var lastReceivedPreferences: UserPreferences?
        
        output.preferences
            .sink { preferences in
                lastReceivedPreferences = preferences
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // When
        testQueue.async {
            notificationTimeSubject.send("11:00")
            notificationPrefSubject.send(.weekly)
        }
        
        testQueue.async {
            areaUnitSubject.send(.squareMeters)
            waterUnitSubject.send(.gallons)
        }
        
        waitForExpectations(timeout: 3) { error in
            XCTAssertNil(error)
            
            // Then
            XCTAssertNotNil(lastReceivedPreferences)
            XCTAssertEqual(lastReceivedPreferences?.reminderTime, "11:00")
            XCTAssertEqual(lastReceivedPreferences?.notificationPreference, .weekly)
            XCTAssertEqual(lastReceivedPreferences?.areaUnit, .squareMeters)
            XCTAssertEqual(lastReceivedPreferences?.waterUnit, .gallons)
        }
    }
}