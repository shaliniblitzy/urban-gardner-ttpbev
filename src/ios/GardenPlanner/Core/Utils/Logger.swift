import Foundation
import os.log

/// A thread-safe logging utility that provides multi-level logging with context-rich output,
/// log rotation, and integration with system logging for the Garden Planner iOS application.
final class Logger {
    // MARK: - Constants
    
    private let LOG_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss.SSS"
    private let MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
    private let LOG_RETENTION_DAYS = 7
    
    // MARK: - Singleton
    
    /// Shared instance of the Logger
    static let shared = Logger()
    
    // MARK: - Properties
    
    private let dateFormatter: DateFormatter
    private let osLog: OSLog
    private let loggingQueue: DispatchQueue
    private let logFileURL: URL
    private var logFileHandle: FileHandle?
    private var currentLogSize: Int = 0
    
    // MARK: - Initialization
    
    private init() {
        // Initialize date formatter
        dateFormatter = DateFormatter()
        dateFormatter.dateFormat = LOG_DATE_FORMAT
        
        // Create logging queue
        loggingQueue = DispatchQueue(label: "com.gardenplanner.logger", qos: .utility)
        
        // Initialize OS Logger
        osLog = OSLog(subsystem: "com.gardenplanner", category: "GardenPlanner")
        
        // Set up log file
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        logFileURL = documentsPath.appendingPathComponent("GardenPlanner.log")
        
        // Create log file if it doesn't exist
        if !FileManager.default.fileExists(atPath: logFileURL.path) {
            FileManager.default.createFile(atPath: logFileURL.path, contents: nil)
        }
        
        // Open log file handle
        do {
            logFileHandle = try FileHandle(forWritingTo: logFileURL)
            currentLogSize = try FileManager.default.attributesOfItem(atPath: logFileURL.path)[.size] as? Int ?? 0
        } catch {
            os_log("Failed to initialize log file: %{public}@", log: osLog, type: .error, error.localizedDescription)
        }
        
        // Clean up old log files
        cleanupOldLogFiles()
    }
    
    deinit {
        logFileHandle?.closeFile()
    }
    
    // MARK: - Public Methods
    
    /// Logs a debug message with source context
    /// - Parameters:
    ///   - message: The debug message to log
    ///   - file: Source file name (auto-filled)
    ///   - line: Source line number (auto-filled)
    ///   - function: Function name (auto-filled)
    func debug(_ message: String, file: String = #file, line: Int = #line, function: String = #function) {
        loggingQueue.async { [weak self] in
            guard let self = self else { return }
            let formattedMessage = self.formatMessage("DEBUG", message: message, file: file, line: line, function: function)
            self.writeToFile(formattedMessage)
            os_log("%{public}@", log: self.osLog, type: .debug, formattedMessage)
            #if DEBUG
            print(formattedMessage)
            #endif
        }
    }
    
    /// Logs an info message
    /// - Parameters:
    ///   - message: The info message to log
    ///   - file: Source file name (auto-filled)
    ///   - line: Source line number (auto-filled)
    ///   - function: Function name (auto-filled)
    func info(_ message: String, file: String = #file, line: Int = #line, function: String = #function) {
        loggingQueue.async { [weak self] in
            guard let self = self else { return }
            let formattedMessage = self.formatMessage("INFO", message: message, file: file, line: line, function: function)
            self.writeToFile(formattedMessage)
            os_log("%{public}@", log: self.osLog, type: .info, formattedMessage)
        }
    }
    
    /// Logs an error with full context and stack trace
    /// - Parameters:
    ///   - error: The error to log
    ///   - file: Source file name (auto-filled)
    ///   - line: Source line number (auto-filled)
    ///   - function: Function name (auto-filled)
    func error(_ error: Error, file: String = #file, line: Int = #line, function: String = #function) {
        loggingQueue.sync { [weak self] in
            guard let self = self else { return }
            
            var errorContext = ""
            if let gardenError = error as? GardenPlannerError {
                errorContext = "\nError Code: \(gardenError.code.rawValue)"
            }
            
            let formattedMessage = self.formatMessage("ERROR", message: """
                Error: \(error.localizedDescription)
                \(errorContext)
                Source: \((file as NSString).lastPathComponent):\(line)
                Function: \(function)
                App Version: \(AppVersion.current)
                Stack Trace:
                \(Thread.callStackSymbols.joined(separator: "\n"))
                """)
            
            self.writeToFile(formattedMessage)
            os_log("%{public}@", log: self.osLog, type: .error, formattedMessage)
        }
    }
    
    // MARK: - Private Methods
    
    private func formatMessage(_ level: String, message: String, file: String, line: Int, function: String) -> String {
        let timestamp = dateFormatter.string(from: Date())
        let filename = (file as NSString).lastPathComponent
        let threadName = Thread.current.isMainThread ? "main" : Thread.current.description
        
        return "[\(timestamp)] [\(level)] [\(threadName)] [\(filename):\(line)] \(function): \(message)"
    }
    
    private func writeToFile(_ message: String) {
        guard let logFileHandle = logFileHandle else { return }
        
        let messageData = (message + "\n").data(using: .utf8) ?? Data()
        do {
            try logFileHandle.seekToEnd()
            logFileHandle.write(messageData)
            currentLogSize += messageData.count
            
            if currentLogSize >= MAX_LOG_SIZE_BYTES {
                rotateLogFile()
            }
        } catch {
            os_log("Failed to write to log file: %{public}@", log: osLog, type: .error, error.localizedDescription)
        }
    }
    
    private func rotateLogFile() {
        logFileHandle?.closeFile()
        
        let dateStr = dateFormatter.string(from: Date())
        let rotatedLogURL = logFileURL.deletingLastPathComponent()
            .appendingPathComponent("GardenPlanner-\(dateStr).log")
        
        do {
            try FileManager.default.moveItem(at: logFileURL, to: rotatedLogURL)
            FileManager.default.createFile(atPath: logFileURL.path, contents: nil)
            logFileHandle = try FileHandle(forWritingTo: logFileURL)
            currentLogSize = 0
        } catch {
            os_log("Failed to rotate log file: %{public}@", log: osLog, type: .error, error.localizedDescription)
        }
    }
    
    private func cleanupOldLogFiles() {
        let fileManager = FileManager.default
        let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        
        do {
            let logFiles = try fileManager.contentsOfDirectory(at: documentsPath,
                                                             includingPropertiesForKeys: [.creationDateKey],
                                                             options: .skipsHiddenFiles)
            
            let oldLogFiles = logFiles.filter { url in
                guard url.pathExtension == "log" else { return false }
                guard let creationDate = try? url.resourceValues(forKeys: [.creationDateKey]).creationDate else {
                    return false
                }
                return Date().timeIntervalSince(creationDate) > TimeInterval(LOG_RETENTION_DAYS * 24 * 60 * 60)
            }
            
            try oldLogFiles.forEach { url in
                try fileManager.removeItem(at: url)
            }
        } catch {
            os_log("Failed to cleanup old log files: %{public}@", log: osLog, type: .error, error.localizedDescription)
        }
    }
}