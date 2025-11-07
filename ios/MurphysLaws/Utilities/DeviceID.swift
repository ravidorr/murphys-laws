//
//  DeviceID.swift
//  MurphysLaws
//
//  Generates and stores a unique device identifier for voting and analytics
//

import Foundation
import UIKit

enum DeviceID {
    /// Gets or creates a unique device identifier
    /// Stored in UserDefaults for persistence across app launches
    static var current: String {
        if let existingID = UserDefaults.standard.string(forKey: Constants.Storage.deviceID) {
            return existingID
        }

        // Generate new UUID
        let newID = UUID().uuidString
        UserDefaults.standard.set(newID, forKey: Constants.Storage.deviceID)

        return newID
    }

    /// Device model information
    static var deviceModel: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let modelCode = withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0)
            }
        }
        return modelCode ?? "Unknown"
    }

    /// iOS version
    static var iosVersion: String {
        UIDevice.current.systemVersion
    }

    /// App version
    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    /// Build number
    static var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    /// Full user agent string for API requests
    static var userAgent: String {
        "MurphysLaws-iOS/\(appVersion) (\(deviceModel); iOS \(iosVersion))"
    }

    /// Resets the device ID (useful for testing)
    static func reset() {
        UserDefaults.standard.removeObject(forKey: Constants.Storage.deviceID)
    }
}
