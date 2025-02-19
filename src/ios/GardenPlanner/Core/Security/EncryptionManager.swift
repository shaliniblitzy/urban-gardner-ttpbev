import Foundation
import CryptoKit
import os.log

/// Thread-safe singleton class managing encryption and decryption of sensitive data
/// using AES-256 with performance optimization and audit logging.
final class EncryptionManager {
    // MARK: - Constants
    
    private let kEncryptionKeyIdentifier = "com.gardenplanner.encryption.key"
    private let kEncryptionAlgorithm = "aes-256-gcm"
    private let kKeyDerivationIterations = 10000
    
    // MARK: - Properties
    
    /// Shared instance of EncryptionManager
    static let shared = EncryptionManager()
    
    private var encryptionKey: SymmetricKey?
    private let keychainManager: KeychainManager
    private let encryptionCache: NSCache<NSString, NSData>
    private let securityLog: OSLog
    private let operationQueue: DispatchQueue
    
    // MARK: - Initialization
    
    private init() {
        keychainManager = KeychainManager.shared
        securityLog = OSLog(subsystem: "com.gardenplanner", category: "Encryption")
        
        // Initialize encryption cache with size limits
        encryptionCache = NSCache<NSString, NSData>()
        encryptionCache.countLimit = 100
        encryptionCache.totalCostLimit = 5 * 1024 * 1024 // 5MB
        
        // Create dedicated queue for encryption operations
        operationQueue = DispatchQueue(label: "com.gardenplanner.encryption",
                                     qos: .userInitiated,
                                     attributes: .concurrent)
        
        // Initialize encryption key
        initializeEncryptionKey()
    }
    
    // MARK: - Public Methods
    
    /// Encrypts data using AES-256 encryption with caching and performance optimization
    /// - Parameters:
    ///   - data: Data to encrypt
    ///   - useCache: Whether to use caching for repeated operations
    /// - Returns: Result containing encrypted data or error
    func encrypt(_ data: Data, useCache: Bool = true) -> Result<Data, GardenPlannerError> {
        // Check cache if enabled
        if useCache {
            let cacheKey = (data.hashValue.description as NSString)
            if let cachedData = encryptionCache.object(forKey: cacheKey) {
                os_log("Retrieved encrypted data from cache", log: securityLog, type: .debug)
                return .success(cachedData as Data)
            }
        }
        
        return operationQueue.sync {
            guard let key = encryptionKey else {
                return .failure(.customError(.databaseError, "Encryption key not initialized"))
            }
            
            do {
                // Generate random nonce
                let nonce = try AES.GCM.Nonce()
                
                // Perform encryption
                let sealedBox = try AES.GCM.seal(data, using: key, nonce: nonce)
                
                // Combine nonce and encrypted data
                var encryptedData = Data()
                encryptedData.append(nonce.withUnsafeBytes { Data($0) })
                encryptedData.append(sealedBox.ciphertext)
                encryptedData.append(sealedBox.tag)
                
                // Update cache if enabled
                if useCache {
                    let cacheKey = (data.hashValue.description as NSString)
                    encryptionCache.setObject(encryptedData as NSData, forKey: cacheKey)
                }
                
                os_log("Data encrypted successfully", log: securityLog, type: .info)
                return .success(encryptedData)
            } catch {
                os_log("Encryption failed: %{public}@", log: securityLog, type: .error, error.localizedDescription)
                return .failure(.customError(.databaseError, "Encryption failed: \(error.localizedDescription)"))
            }
        }
    }
    
    /// Decrypts AES-256 encrypted data with performance optimization
    /// - Parameters:
    ///   - encryptedData: Data to decrypt
    ///   - useCache: Whether to use caching for repeated operations
    /// - Returns: Result containing decrypted data or error
    func decrypt(_ encryptedData: Data, useCache: Bool = true) -> Result<Data, GardenPlannerError> {
        // Check cache if enabled
        if useCache {
            let cacheKey = (encryptedData.hashValue.description as NSString)
            if let cachedData = encryptionCache.object(forKey: cacheKey) {
                os_log("Retrieved decrypted data from cache", log: securityLog, type: .debug)
                return .success(cachedData as Data)
            }
        }
        
        return operationQueue.sync {
            guard let key = encryptionKey else {
                return .failure(.customError(.databaseError, "Encryption key not initialized"))
            }
            
            do {
                // Extract nonce, ciphertext and tag
                let nonceBytes = encryptedData.prefix(12)
                let ciphertext = encryptedData.dropFirst(12).dropLast(16)
                let tag = encryptedData.suffix(16)
                
                guard let nonce = try? AES.GCM.Nonce(data: nonceBytes) else {
                    return .failure(.customError(.databaseError, "Invalid nonce"))
                }
                
                // Recreate sealed box
                let sealedBox = try AES.GCM.SealedBox(nonce: nonce,
                                                     ciphertext: ciphertext,
                                                     tag: tag)
                
                // Perform decryption
                let decryptedData = try AES.GCM.open(sealedBox, using: key)
                
                // Update cache if enabled
                if useCache {
                    let cacheKey = (encryptedData.hashValue.description as NSString)
                    encryptionCache.setObject(decryptedData as NSData, forKey: cacheKey)
                }
                
                os_log("Data decrypted successfully", log: securityLog, type: .info)
                return .success(decryptedData)
            } catch {
                os_log("Decryption failed: %{public}@", log: securityLog, type: .error, error.localizedDescription)
                return .failure(.customError(.databaseError, "Decryption failed: \(error.localizedDescription)"))
            }
        }
    }
    
    /// Rotates encryption key with secure backup
    /// - Returns: Result indicating success or error
    func rotateEncryptionKey() -> Result<Void, GardenPlannerError> {
        return operationQueue.sync(flags: .barrier) {
            do {
                // Generate new key
                let newKey = SymmetricKey(size: .bits256)
                
                // Backup current key
                if let currentKey = encryptionKey {
                    let backupKeyId = "\(kEncryptionKeyIdentifier).backup"
                    let keyData = currentKey.withUnsafeBytes { Data($0) }
                    
                    let backupResult = keychainManager.saveItem(keyData,
                                                              forKey: backupKeyId,
                                                              withAccessibility: kSecAttrAccessibleAfterFirstUnlock)
                    
                    if case .failure(let error) = backupResult {
                        return .failure(error)
                    }
                }
                
                // Save new key
                let keyData = newKey.withUnsafeBytes { Data($0) }
                let saveResult = keychainManager.saveItem(keyData,
                                                        forKey: kEncryptionKeyIdentifier,
                                                        withAccessibility: kSecAttrAccessibleAfterFirstUnlock)
                
                if case .failure(let error) = saveResult {
                    return .failure(error)
                }
                
                // Update current key
                encryptionKey = newKey
                
                // Clear cache
                encryptionCache.removeAllObjects()
                
                os_log("Encryption key rotated successfully", log: securityLog, type: .info)
                return .success(())
            } catch {
                os_log("Key rotation failed: %{public}@", log: securityLog, type: .error, error.localizedDescription)
                return .failure(.customError(.databaseError, "Key rotation failed: \(error.localizedDescription)"))
            }
        }
    }
    
    /// Performs batch encryption of multiple data items with optimized performance
    /// - Parameter dataItems: Array of data items to encrypt
    /// - Returns: Result containing array of encrypted data or error
    func batchEncrypt(_ dataItems: [Data]) -> Result<[Data], GardenPlannerError> {
        guard !dataItems.isEmpty else {
            return .success([])
        }
        
        return operationQueue.sync {
            var encryptedItems: [Data] = []
            var encryptionError: GardenPlannerError?
            
            let group = DispatchGroup()
            let queue = DispatchQueue(label: "com.gardenplanner.encryption.batch",
                                    attributes: .concurrent)
            
            for data in dataItems {
                group.enter()
                queue.async {
                    let result = self.encrypt(data)
                    switch result {
                    case .success(let encryptedData):
                        encryptedItems.append(encryptedData)
                    case .failure(let error):
                        encryptionError = error
                    }
                    group.leave()
                }
            }
            
            group.wait()
            
            if let error = encryptionError {
                os_log("Batch encryption failed: %{public}@", log: securityLog, type: .error, error.localizedDescription)
                return .failure(error)
            }
            
            os_log("Batch encryption completed successfully", log: securityLog, type: .info)
            return .success(encryptedItems)
        }
    }
    
    // MARK: - Private Methods
    
    private func initializeEncryptionKey() {
        let result = keychainManager.retrieveItem(forKey: kEncryptionKeyIdentifier)
        
        switch result {
        case .success(let keyData):
            encryptionKey = SymmetricKey(data: keyData)
            os_log("Encryption key loaded successfully", log: securityLog, type: .info)
            
        case .failure(_):
            // Generate new key if not found
            let newKey = SymmetricKey(size: .bits256)
            let keyData = newKey.withUnsafeBytes { Data($0) }
            
            let saveResult = keychainManager.saveItem(keyData,
                                                    forKey: kEncryptionKeyIdentifier,
                                                    withAccessibility: kSecAttrAccessibleAfterFirstUnlock)
            
            if case .success = saveResult {
                encryptionKey = newKey
                os_log("New encryption key generated and saved", log: securityLog, type: .info)
            } else {
                os_log("Failed to initialize encryption key", log: securityLog, type: .error)
            }
        }
    }
}