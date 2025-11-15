//
//  Logger.swift
//  MurphysLaws
//
//  Logging utility that respects configuration
//

import Foundation
import os.log

enum LogLevel: String, Comparable {
    case debug = "debug"
    case info = "info"
    case warning = "warning"
    case error = "error"
    
    var priority: Int {
        switch self {
        case .debug: return 0
        case .info: return 1
        case .warning: return 2
        case .error: return 3
        }
    }
    
    static func < (lhs: LogLevel, rhs: LogLevel) -> Bool {
        return lhs.priority < rhs.priority
    }
}

class Logger {
    static let shared = Logger()
    
    private let osLog = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "com.murphyslaws", category: "App")
    
    private let minimumLevel: LogLevel
    
    private init() {
        // Set minimum log level from configuration
        self.minimumLevel = LogLevel(rawValue: Constants.Environment.logLevel.lowercased()) ?? .info
    }
    
    // MARK: - Public Logging Methods
    
    func debug(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .debug, file: file, function: function, line: line)
    }
    
    func info(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .info, file: file, function: function, line: line)
    }
    
    func warning(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .warning, file: file, function: function, line: line)
    }
    
    func error(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .error, file: file, function: function, line: line)
    }
    
    // MARK: - Private Implementation
    
    private func log(_ message: String, level: LogLevel, file: String, function: String, line: Int) {
        // Only log if level meets minimum threshold
        guard level >= minimumLevel else { return }
        
        let fileName = (file as NSString).lastPathComponent
        let formattedMessage = "[\(level.rawValue.uppercased())] [\(fileName):\(line)] \(function) - \(message)"
        
        // Log to console in debug builds
        #if DEBUG
        print(formattedMessage)
        #endif
        
        // Log to unified logging system
        switch level {
        case .debug:
            os_log("%{public}@", log: osLog, type: .debug, formattedMessage)
        case .info:
            os_log("%{public}@", log: osLog, type: .info, formattedMessage)
        case .warning:
            os_log("%{public}@", log: osLog, type: .default, formattedMessage)
        case .error:
            os_log("%{public}@", log: osLog, type: .error, formattedMessage)
        }
    }
}

// MARK: - Convenience Global Functions

func logDebug(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
    Logger.shared.debug(message, file: file, function: function, line: line)
}

func logInfo(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
    Logger.shared.info(message, file: file, function: function, line: line)
}

func logWarning(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
    Logger.shared.warning(message, file: file, function: function, line: line)
}

func logError(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
    Logger.shared.error(message, file: file, function: function, line: line)
}

