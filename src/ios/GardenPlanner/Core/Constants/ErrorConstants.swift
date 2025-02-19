import Foundation

// MARK: - HTTP Status Codes
enum HTTPStatusCode: Int {
    case ok = 200
    case badRequest = 400
    case unauthorized = 401
    case forbidden = 403
    case notFound = 404
    case internalServerError = 500
    case serviceUnavailable = 503
}

// MARK: - Retry Configuration
struct RetryConfiguration {
    static let maxAttempts: Int = 3
    static let retryInterval: TimeInterval = 5.0
    static let timeout: TimeInterval = 30.0
}

// MARK: - Error Codes
enum ErrorCode: String, CaseIterable {
    case invalidGardenDimensions = "E001"
    case incompatiblePlants = "E002"
    case insufficientSunlightData = "E003"
    case scheduleGenerationFailed = "E004"
    case notificationDeliveryFailed = "E005"
    case databaseError = "E006"
}

// MARK: - Error Messages
struct ErrorMessage {
    private static let messages: [ErrorCode: String] = [
        .invalidGardenDimensions: "Invalid garden dimensions. Please enter a value between 1-1000 sq ft.",
        .incompatiblePlants: "Selected plants are not compatible for planting together. Please adjust your selection.",
        .insufficientSunlightData: "Insufficient sunlight data. Please complete zone information.",
        .scheduleGenerationFailed: "Failed to generate maintenance schedule. Please try again or reset preferences.",
        .notificationDeliveryFailed: "Unable to deliver notification. Please check device settings.",
        .databaseError: "Database operation failed. Please try again."
    ]
    
    static func localizedDescription(for code: ErrorCode) -> String {
        return messages[code] ?? "An unknown error occurred."
    }
    
    static func code(for error: ErrorCode) -> String {
        return error.rawValue
    }
}

// MARK: - Garden Planner Error
enum GardenPlannerError: Error {
    case invalidInput(ErrorCode)
    case systemError(Error)
    case networkError(HTTPStatusCode)
    case customError(ErrorCode, String)
    
    var error: Error {
        switch self {
        case .systemError(let error):
            return error
        default:
            return self
        }
    }
    
    var code: ErrorCode {
        switch self {
        case .invalidInput(let code):
            return code
        case .systemError:
            return .databaseError
        case .networkError:
            return .notificationDeliveryFailed
        case .customError(let code, _):
            return code
        }
    }
    
    var localizedDescription: String {
        switch self {
        case .invalidInput(let code):
            return ErrorMessage.localizedDescription(for: code)
        case .systemError(let error):
            return error.localizedDescription
        case .networkError(let statusCode):
            return "Network error occurred: \(statusCode.rawValue)"
        case .customError(_, let message):
            return message
        }
    }
}

// MARK: - Error Handling Extensions
extension GardenPlannerError {
    static func shouldRetry(_ error: Error) -> Bool {
        guard let gardenError = error as? GardenPlannerError else { return false }
        
        switch gardenError {
        case .networkError(let statusCode):
            return statusCode == .serviceUnavailable
        case .systemError:
            return true
        default:
            return false
        }
    }
    
    static func isRecoverable(_ error: Error) -> Bool {
        guard let gardenError = error as? GardenPlannerError else { return false }
        
        switch gardenError {
        case .invalidInput, .customError:
            return true
        case .networkError(let statusCode):
            return statusCode != .unauthorized && statusCode != .forbidden
        case .systemError:
            return true
        }
    }
}