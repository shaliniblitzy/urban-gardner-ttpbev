import Foundation
import LocalAuthentication

/// A singleton manager class that handles biometric authentication (Face ID/Touch ID) for secure access
/// to the Garden Planner application with enhanced security features including session management,
/// jailbreak detection, and secure state persistence.
final class BiometricAuthManager {
    
    // MARK: - Constants
    
    private let kBiometricStateKey = "com.gardenplanner.biometricState"
    private let kAuthenticationReason = "Authenticate to access Garden Planner"
    private let kMaxAuthenticationRetries = 3
    private let kSessionDuration: TimeInterval = 3600.0 // 1 hour
    
    // MARK: - Singleton
    
    /// Shared instance of BiometricAuthManager
    static let shared = BiometricAuthManager()
    
    // MARK: - Properties
    
    private let context: LAContext
    private(set) var isBiometricsEnabled: Bool
    private(set) var biometryType: LABiometryType
    private let authenticationPolicy: LAPolicy
    private var lastAuthenticationDate: Date?
    private var authenticationRetryCount: Int
    
    // MARK: - Initialization
    
    private init() {
        context = LAContext()
        context.touchIDAuthenticationAllowableReuseDuration = 0
        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = "Use Passcode"
        
        authenticationPolicy = .deviceOwnerAuthenticationWithBiometrics
        biometryType = .none
        isBiometricsEnabled = false
        authenticationRetryCount = 0
        
        // Load persisted biometric state
        if case .success(let data) = KeychainManager.shared.retrieveItem(forKey: kBiometricStateKey),
           let enabled = try? JSONDecoder().decode(Bool.self, from: data) {
            isBiometricsEnabled = enabled
        }
        
        // Determine available biometry type
        var error: NSError?
        if context.canEvaluatePolicy(authenticationPolicy, error: &error) {
            biometryType = context.biometryType
        }
        
        Logger.shared.security("BiometricAuthManager initialized with type: \(biometryType.rawValue)")
    }
    
    // MARK: - Public Methods
    
    /// Validates device biometric capability with security checks
    /// - Returns: Result indicating biometric availability status or security error
    func canUseBiometrics() -> Result<Bool, GardenPlannerError> {
        var error: NSError?
        
        // Check for jailbreak
        #if !targetEnvironment(simulator)
        if isJailbroken() {
            Logger.shared.security("Device security compromised: Jailbreak detected")
            return .failure(.customError(.databaseError, "Device security compromised"))
        }
        #endif
        
        // Verify biometric hardware
        guard context.canEvaluatePolicy(authenticationPolicy, error: &error) else {
            let errorMessage = error?.localizedDescription ?? "Biometric authentication unavailable"
            Logger.shared.error(GardenPlannerError.customError(.databaseError, errorMessage))
            return .failure(.customError(.databaseError, errorMessage))
        }
        
        // Verify keychain accessibility
        let testData = "BiometricTest".data(using: .utf8)!
        let keychainResult = KeychainManager.shared.saveItem(
            testData,
            forKey: "biometric_test",
            withAccessibility: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
        )
        
        switch keychainResult {
        case .success:
            _ = KeychainManager.shared.deleteItem(forKey: "biometric_test")
            return .success(true)
        case .failure(let error):
            Logger.shared.error(error)
            return .failure(error)
        }
    }
    
    /// Performs secure biometric authentication with session management
    /// - Parameter completion: Callback with authentication result
    func authenticateUser(completion: @escaping (Result<Bool, GardenPlannerError>) -> Void) {
        // Check session validity
        if let lastAuth = lastAuthenticationDate,
           Date().timeIntervalSince(lastAuth) < kSessionDuration {
            completion(.success(true))
            return
        }
        
        // Check retry count
        guard authenticationRetryCount < kMaxAuthenticationRetries else {
            let error = GardenPlannerError.customError(.databaseError, "Maximum authentication attempts exceeded")
            Logger.shared.security("Authentication blocked: Max retries exceeded")
            completion(.failure(error))
            return
        }
        
        // Create fresh context for each authentication
        let authContext = LAContext()
        authContext.localizedReason = kAuthenticationReason
        
        authContext.evaluatePolicy(authenticationPolicy, localizedReason: kAuthenticationReason) { [weak self] success, error in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                if success {
                    self.lastAuthenticationDate = Date()
                    self.authenticationRetryCount = 0
                    Logger.shared.security("Biometric authentication successful")
                    completion(.success(true))
                } else {
                    self.authenticationRetryCount += 1
                    let errorMessage = error?.localizedDescription ?? "Authentication failed"
                    Logger.shared.error(GardenPlannerError.customError(.databaseError, errorMessage))
                    completion(.failure(.customError(.databaseError, errorMessage)))
                }
            }
        }
    }
    
    /// Securely enables biometric authentication with state validation
    /// - Parameter completion: Callback with enable operation result
    func enableBiometrics(completion: @escaping (Result<Void, GardenPlannerError>) -> Void) {
        // Verify device security and biometric availability
        switch canUseBiometrics() {
        case .success:
            do {
                let encodedState = try JSONEncoder().encode(true)
                let saveResult = KeychainManager.shared.saveItem(
                    encodedState,
                    forKey: kBiometricStateKey,
                    withAccessibility: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
                )
                
                switch saveResult {
                case .success:
                    isBiometricsEnabled = true
                    Logger.shared.security("Biometric authentication enabled")
                    completion(.success(()))
                case .failure(let error):
                    Logger.shared.error(error)
                    completion(.failure(error))
                }
            } catch {
                let error = GardenPlannerError.customError(.databaseError, "Failed to encode biometric state")
                Logger.shared.error(error)
                completion(.failure(error))
            }
            
        case .failure(let error):
            completion(.failure(error))
        }
    }
    
    /// Securely disables biometric authentication with state cleanup
    /// - Returns: Result indicating disable operation success or error
    func disableBiometrics() -> Result<Void, GardenPlannerError> {
        // Clear session state
        lastAuthenticationDate = nil
        authenticationRetryCount = 0
        
        // Remove persisted state
        let result = KeychainManager.shared.deleteItem(forKey: kBiometricStateKey)
        
        switch result {
        case .success:
            isBiometricsEnabled = false
            Logger.shared.security("Biometric authentication disabled")
            return .success(())
        case .failure(let error):
            Logger.shared.error(error)
            return .failure(error)
        }
    }
    
    // MARK: - Private Methods
    
    private func isJailbroken() -> Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        let paths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/private/var/lib/apt/"
        ]
        
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return true
            }
        }
        
        let path = "/private/jailbreak.txt"
        do {
            try "test".write(toFile: path, atomically: true, encoding: .utf8)
            try FileManager.default.removeItem(atPath: path)
            return true
        } catch {
            return false
        }
        #endif
    }
}