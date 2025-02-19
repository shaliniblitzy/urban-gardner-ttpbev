import Foundation
import Security

/// Thread-safe singleton utility class for secure storage and retrieval of sensitive data
/// using iOS Keychain Services with enhanced security features and performance optimizations.
final class KeychainManager {
    // MARK: - Constants
    
    private let kServiceIdentifier = "com.gardenplanner.keychain"
    private let kAccessGroup = "com.gardenplanner.shared"
    private let keychainQueue = DispatchQueue(label: "com.gardenplanner.keychain.queue", qos: .userInitiated)
    
    // MARK: - Singleton
    
    /// Shared instance of KeychainManager
    static let shared = KeychainManager()
    
    // MARK: - Properties
    
    private let cache: NSCache<NSString, NSData>
    private let serviceIdentifier: String
    private let accessGroup: String
    
    // MARK: - Initialization
    
    private init() {
        self.serviceIdentifier = kServiceIdentifier
        self.accessGroup = kAccessGroup
        
        // Initialize secure cache with size limits
        cache = NSCache<NSString, NSData>()
        cache.countLimit = 100
        cache.totalCostLimit = 1024 * 1024 // 1MB
        
        Logger.shared.security("KeychainManager initialized with enhanced security settings")
    }
    
    // MARK: - Public Methods
    
    /// Securely saves data to keychain with enhanced error handling and logging
    /// - Parameters:
    ///   - data: Data to be stored
    ///   - key: Unique identifier for the data
    ///   - accessibility: Keychain accessibility level
    /// - Returns: Result indicating success or detailed security error
    func saveItem(_ data: Data, 
                 forKey key: String, 
                 withAccessibility accessibility: CFString = kSecAttrAccessibleAfterFirstUnlock) -> Result<Void, GardenPlannerError> {
        return keychainQueue.sync {
            // Validate input parameters
            guard !key.isEmpty else {
                Logger.shared.error(GardenPlannerError.invalidInput(.databaseError))
                return .failure(.invalidInput(.databaseError))
            }
            
            var query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: serviceIdentifier,
                kSecAttrAccessGroup as String: accessGroup,
                kSecAttrAccount as String: key,
                kSecValueData as String: data,
                kSecAttrAccessible as String: accessibility,
                kSecUseDataProtectionKeychain as String: true
            ]
            
            // Add biometric protection for sensitive data
            if accessibility as String == kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly as String {
                let accessControl = SecAccessControlCreateWithFlags(nil,
                    accessibility,
                    .biometryAny,
                    nil)
                query[kSecAttrAccessControl as String] = accessControl
            }
            
            // Attempt to save with retry logic
            var result: OSStatus = errSecSuccess
            var attempts = 0
            repeat {
                result = SecItemAdd(query as CFDictionary, nil)
                if result == errSecDuplicateItem {
                    // Item exists, update it
                    let updateQuery = [
                        kSecClass as String: kSecClassGenericPassword,
                        kSecAttrService as String: serviceIdentifier,
                        kSecAttrAccount as String: key
                    ] as CFDictionary
                    
                    let updateAttributes = [
                        kSecValueData as String: data
                    ] as CFDictionary
                    
                    result = SecItemUpdate(updateQuery, updateAttributes)
                }
                attempts += 1
            } while result != errSecSuccess && attempts < RetryConfiguration.maxAttempts
            
            if result == errSecSuccess {
                // Update cache on successful save
                cache.setObject(data as NSData, forKey: key as NSString)
                Logger.shared.security("Successfully saved item to keychain: \(key)")
                return .success(())
            } else {
                let error = GardenPlannerError.customError(.databaseError, "Keychain save failed with status: \(result)")
                Logger.shared.error(error)
                return .failure(error)
            }
        }
    }
    
    /// Securely retrieves data from keychain with caching and performance optimization
    /// - Parameters:
    ///   - key: Key to retrieve data for
    ///   - useCache: Whether to check cache before accessing keychain
    /// - Returns: Result containing retrieved data or security-aware error
    func retrieveItem(forKey key: String, useCache: Bool = true) -> Result<Data, GardenPlannerError> {
        return keychainQueue.sync {
            // Check cache if enabled
            if useCache, let cachedData = cache.object(forKey: key as NSString) {
                Logger.shared.security("Retrieved item from cache: \(key)")
                return .success(cachedData as Data)
            }
            
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: serviceIdentifier,
                kSecAttrAccount as String: key,
                kSecReturnData as String: true,
                kSecUseDataProtectionKeychain as String: true,
                kSecAttrAccessGroup as String: accessGroup
            ]
            
            var result: AnyObject?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            
            if status == errSecSuccess, let data = result as? Data {
                // Update cache with retrieved data
                cache.setObject(data as NSData, forKey: key as NSString)
                Logger.shared.security("Successfully retrieved item from keychain: \(key)")
                return .success(data)
            } else {
                let error = GardenPlannerError.customError(.databaseError, "Keychain retrieval failed with status: \(status)")
                Logger.shared.error(error)
                return .failure(error)
            }
        }
    }
    
    /// Securely removes item from keychain with audit logging
    /// - Parameter key: Key of item to delete
    /// - Returns: Result indicating success or security error
    func deleteItem(forKey key: String) -> Result<Void, GardenPlannerError> {
        return keychainQueue.sync {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: serviceIdentifier,
                kSecAttrAccount as String: key,
                kSecAttrAccessGroup as String: accessGroup
            ]
            
            // Remove from cache first
            cache.removeObject(forKey: key as NSString)
            
            let status = SecItemDelete(query as CFDictionary)
            
            if status == errSecSuccess || status == errSecItemNotFound {
                Logger.shared.security("Successfully deleted item from keychain: \(key)")
                return .success(())
            } else {
                let error = GardenPlannerError.customError(.databaseError, "Keychain deletion failed with status: \(status)")
                Logger.shared.error(error)
                return .failure(error)
            }
        }
    }
    
    /// Atomically updates existing keychain item with security validation
    /// - Parameters:
    ///   - data: New data to store
    ///   - key: Key to update
    ///   - accessibility: Keychain accessibility level
    /// - Returns: Result indicating success or security error
    func updateItem(_ data: Data, 
                   forKey key: String, 
                   withAccessibility accessibility: CFString = kSecAttrAccessibleAfterFirstUnlock) -> Result<Void, GardenPlannerError> {
        return keychainQueue.sync {
            // First check if item exists
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: serviceIdentifier,
                kSecAttrAccount as String: key,
                kSecAttrAccessGroup as String: accessGroup
            ]
            
            let updateAttributes: [String: Any] = [
                kSecValueData as String: data,
                kSecAttrAccessible as String: accessibility
            ]
            
            let status = SecItemUpdate(query as CFDictionary, updateAttributes as CFDictionary)
            
            if status == errSecSuccess {
                // Update cache with new data
                cache.setObject(data as NSData, forKey: key as NSString)
                Logger.shared.security("Successfully updated item in keychain: \(key)")
                return .success(())
            } else if status == errSecItemNotFound {
                // Item doesn't exist, create it
                return saveItem(data, forKey: key, withAccessibility: accessibility)
            } else {
                let error = GardenPlannerError.customError(.databaseError, "Keychain update failed with status: \(status)")
                Logger.shared.error(error)
                return .failure(error)
            }
        }
    }
}