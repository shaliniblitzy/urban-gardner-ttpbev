import Foundation
import Combine
import os.log

/// Thread-safe service class that manages user preferences with secure persistence,
/// encryption, and audit logging for the Garden Planner application.
final class UserPreferencesService {
    // MARK: - Constants
    
    private let kPreferencesKey = "user_preferences_v2"
    private let kMaxRetryAttempts = 3
    private let kKeyRotationInterval: TimeInterval = 604800 // 7 days
    
    // MARK: - Properties
    
    /// Publisher for observing preference changes
    public let preferencesPublisher: CurrentValueSubject<UserPreferences, Never>
    
    private let keychainManager: KeychainManager
    private let logger: OSLog
    private let serialQueue: DispatchQueue
    private var keyRotationTimer: Timer?
    
    private let defaultPreferences = UserPreferences(
        notificationPreference: .daily,
        reminderTime: "09:00",
        areaUnit: .squareFeet,
        waterUnit: .liters,
        pushNotificationsEnabled: true,
        emailNotificationsEnabled: false
    )
    
    // MARK: - Initialization
    
    init() {
        self.keychainManager = KeychainManager.shared
        self.logger = OSLog(subsystem: "com.gardenplanner", category: "UserPreferences")
        self.serialQueue = DispatchQueue(label: "com.gardenplanner.preferences.queue", qos: .userInitiated)
        
        // Initialize with default preferences
        self.preferencesPublisher = CurrentValueSubject<UserPreferences, Never>(defaultPreferences)
        
        // Load saved preferences
        loadPreferences()
        
        // Setup key rotation timer
        setupKeyRotationTimer()
        
        os_log("UserPreferencesService initialized", log: logger, type: .info)
    }
    
    deinit {
        keyRotationTimer?.invalidate()
    }
    
    // MARK: - Public Methods
    
    /// Loads encrypted user preferences from secure storage with retry mechanism
    @discardableResult
    func loadPreferences() -> UserPreferences {
        var attempts = 0
        var loadedPreferences: UserPreferences?
        
        repeat {
            let result = serialQueue.sync {
                keychainManager.retrieveItem(forKey: kPreferencesKey)
            }
            
            switch result {
            case .success(let data):
                do {
                    loadedPreferences = try JSONDecoder().decode(UserPreferences.self, from: data)
                    break
                } catch {
                    os_log("Failed to decode preferences: %{public}@", log: logger, type: .error, error.localizedDescription)
                }
            case .failure(let error):
                os_log("Failed to load preferences: %{public}@", log: logger, type: .error, error.localizedDescription)
            }
            
            attempts += 1
            if attempts < kMaxRetryAttempts {
                Thread.sleep(forTimeInterval: RetryConfiguration.retryInterval)
            }
        } while loadedPreferences == nil && attempts < kMaxRetryAttempts
        
        let preferences = loadedPreferences ?? defaultPreferences
        preferencesPublisher.send(preferences)
        
        return preferences
    }
    
    /// Saves user preferences with encryption to secure storage
    func savePreferences(_ preferences: UserPreferences) -> Result<Void, GardenPlannerError> {
        return serialQueue.sync {
            do {
                let data = try JSONEncoder().encode(preferences)
                let result = keychainManager.saveItem(data, forKey: kPreferencesKey)
                
                switch result {
                case .success:
                    preferencesPublisher.send(preferences)
                    os_log("Preferences saved successfully", log: logger, type: .info)
                    return .success(())
                case .failure(let error):
                    os_log("Failed to save preferences: %{public}@", log: logger, type: .error, error.localizedDescription)
                    return .failure(error)
                }
            } catch {
                let gardenError = GardenPlannerError.systemError(error)
                os_log("Failed to encode preferences: %{public}@", log: logger, type: .error, error.localizedDescription)
                return .failure(gardenError)
            }
        }
    }
    
    /// Thread-safe update of notification preferences with validation
    func updateNotificationPreferences(
        preference: NotificationPreference,
        reminderTime: String,
        pushEnabled: Bool,
        emailEnabled: Bool
    ) -> Result<Void, GardenPlannerError> {
        return serialQueue.sync {
            let currentPreferences = preferencesPublisher.value
            
            let newPreferences = UserPreferences(
                notificationPreference: preference,
                reminderTime: reminderTime,
                areaUnit: currentPreferences.areaUnit,
                waterUnit: currentPreferences.waterUnit,
                pushNotificationsEnabled: pushEnabled,
                emailNotificationsEnabled: emailEnabled
            )
            
            return savePreferences(newPreferences)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupKeyRotationTimer() {
        keyRotationTimer = Timer.scheduledTimer(
            withTimeInterval: kKeyRotationInterval,
            repeats: true
        ) { [weak self] _ in
            self?.rotateEncryptionKey()
        }
    }
    
    private func rotateEncryptionKey() -> Result<Void, GardenPlannerError> {
        return serialQueue.sync {
            let currentPreferences = preferencesPublisher.value
            
            // Generate new encryption key
            let result = keychainManager.updateItem(
                try! JSONEncoder().encode(currentPreferences),
                forKey: kPreferencesKey
            )
            
            switch result {
            case .success:
                os_log("Encryption key rotated successfully", log: logger, type: .info)
                return .success(())
            case .failure(let error):
                os_log("Failed to rotate encryption key: %{public}@", log: logger, type: .error, error.localizedDescription)
                return .failure(error)
            }
        }
    }
}