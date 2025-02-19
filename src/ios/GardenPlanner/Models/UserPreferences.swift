import Foundation
import Combine

/// Constants for user preferences
private enum PreferenceConstants {
    static let kDefaultReminderTime = "09:00"
    static let kDefaultAreaUnit = "squareFeet"
    static let kDefaultWaterUnit = "liters"
    static let kPreferencesKey = "com.gardenplanner.userpreferences"
    static let kTimeFormat = "HH:mm"
}

/// Represents different notification preference options
@objc public enum NotificationPreference: Int, Codable, Equatable {
    case daily
    case weekly
    case custom
    
    var description: String {
        switch self {
        case .daily: return NSLocalizedString("Daily", comment: "Daily notification preference")
        case .weekly: return NSLocalizedString("Weekly", comment: "Weekly notification preference")
        case .custom: return NSLocalizedString("Custom", comment: "Custom notification preference")
        }
    }
}

/// Represents measurement units with conversion support
@objc public enum MeasurementUnit: Int, Codable, Equatable {
    case squareFeet
    case squareMeters
    case liters
    case gallons
    
    var isAreaUnit: Bool {
        switch self {
        case .squareFeet, .squareMeters: return true
        case .liters, .gallons: return false
        }
    }
    
    func convert(_ value: Double, to unit: MeasurementUnit) -> Double {
        guard self != unit else { return value }
        guard isAreaUnit == unit.isAreaUnit else {
            Logger.shared.error(GardenPlannerError.invalidInput(.databaseError))
            return value
        }
        
        switch (self, unit) {
        case (.squareFeet, .squareMeters):
            return value * 0.092903
        case (.squareMeters, .squareFeet):
            return value * 10.7639
        case (.liters, .gallons):
            return value * 0.264172
        case (.gallons, .liters):
            return value * 3.78541
        default:
            return value
        }
    }
}

/// Thread-safe model class for managing and persisting user preferences with encryption
@objc public class UserPreferences: NSObject, Codable, Equatable {
    // MARK: - Properties
    
    public private(set) var notificationPreference: NotificationPreference
    public private(set) var reminderTime: String
    public private(set) var areaUnit: MeasurementUnit
    public private(set) var waterUnit: MeasurementUnit
    public private(set) var pushNotificationsEnabled: Bool
    public private(set) var emailNotificationsEnabled: Bool
    
    public let preferencesChanged = PassthroughSubject<UserPreferences, Never>()
    private let storageLock = NSLock()
    
    // MARK: - Initialization
    
    public init(notificationPreference: NotificationPreference = .daily,
                reminderTime: String = PreferenceConstants.kDefaultReminderTime,
                areaUnit: MeasurementUnit = .squareFeet,
                waterUnit: MeasurementUnit = .liters,
                pushNotificationsEnabled: Bool = true,
                emailNotificationsEnabled: Bool = false) {
        
        guard Self.validateReminderTime(reminderTime) else {
            Logger.shared.error(GardenPlannerError.invalidInput(.databaseError))
            self.reminderTime = PreferenceConstants.kDefaultReminderTime
            self.notificationPreference = .daily
            self.areaUnit = .squareFeet
            self.waterUnit = .liters
            self.pushNotificationsEnabled = true
            self.emailNotificationsEnabled = false
            super.init()
            return
        }
        
        self.notificationPreference = notificationPreference
        self.reminderTime = reminderTime
        self.areaUnit = areaUnit
        self.waterUnit = waterUnit
        self.pushNotificationsEnabled = pushNotificationsEnabled
        self.emailNotificationsEnabled = emailNotificationsEnabled
        super.init()
    }
    
    // MARK: - Public Methods
    
    public static func == (lhs: UserPreferences, rhs: UserPreferences) -> Bool {
        return lhs.notificationPreference == rhs.notificationPreference &&
               lhs.reminderTime == rhs.reminderTime &&
               lhs.areaUnit == rhs.areaUnit &&
               lhs.waterUnit == rhs.waterUnit &&
               lhs.pushNotificationsEnabled == rhs.pushNotificationsEnabled &&
               lhs.emailNotificationsEnabled == rhs.emailNotificationsEnabled
    }
    
    /// Saves preferences securely to keychain
    public func save() -> Result<Void, GardenPlannerError> {
        storageLock.lock()
        defer { storageLock.unlock() }
        
        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(self)
            
            let result = KeychainManager.shared.saveItem(
                data,
                forKey: PreferenceConstants.kPreferencesKey,
                withAccessibility: kSecAttrAccessibleAfterFirstUnlock
            )
            
            switch result {
            case .success:
                preferencesChanged.send(self)
                Logger.shared.info("User preferences saved successfully")
                return .success(())
            case .failure(let error):
                Logger.shared.error(error)
                return .failure(error)
            }
        } catch {
            let gardenError = GardenPlannerError.systemError(error)
            Logger.shared.error(gardenError)
            return .failure(gardenError)
        }
    }
    
    /// Loads preferences from keychain
    public static func load() -> Result<UserPreferences, GardenPlannerError> {
        let result = KeychainManager.shared.retrieveItem(
            forKey: PreferenceConstants.kPreferencesKey
        )
        
        switch result {
        case .success(let data):
            do {
                let decoder = JSONDecoder()
                let preferences = try decoder.decode(UserPreferences.self, from: data)
                Logger.shared.info("User preferences loaded successfully")
                return .success(preferences)
            } catch {
                let gardenError = GardenPlannerError.systemError(error)
                Logger.shared.error(gardenError)
                return .failure(gardenError)
            }
        case .failure(let error):
            // If preferences don't exist, return default preferences
            if case .customError(_, _) = error {
                let defaultPreferences = UserPreferences()
                _ = defaultPreferences.save()
                return .success(defaultPreferences)
            }
            Logger.shared.error(error)
            return .failure(error)
        }
    }
    
    /// Resets preferences to default values
    public func reset() -> Result<Void, GardenPlannerError> {
        storageLock.lock()
        defer { storageLock.unlock() }
        
        let result = KeychainManager.shared.deleteItem(
            forKey: PreferenceConstants.kPreferencesKey
        )
        
        switch result {
        case .success:
            notificationPreference = .daily
            reminderTime = PreferenceConstants.kDefaultReminderTime
            areaUnit = .squareFeet
            waterUnit = .liters
            pushNotificationsEnabled = true
            emailNotificationsEnabled = false
            
            preferencesChanged.send(self)
            Logger.shared.info("User preferences reset to defaults")
            return save()
        case .failure(let error):
            Logger.shared.error(error)
            return .failure(error)
        }
    }
    
    // MARK: - Private Methods
    
    private static func validateReminderTime(_ time: String) -> Bool {
        let formatter = DateFormatter()
        formatter.dateFormat = PreferenceConstants.kTimeFormat
        return formatter.date(from: time) != nil
    }
}