//
//  DateFormatters.swift
//  MurphysLaws
//
//  Centralized date formatting
//

import Foundation

extension DateFormatter {
    /// Date formatter for displaying law creation/update dates
    /// Format: "Jan 15, 2026"
    static let lawDisplay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// Relative date formatter for recent dates
    /// Format: "2 hours ago", "Yesterday", etc.
    static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.dateTimeStyle = .named
        formatter.unitsStyle = .full
        return formatter
    }()

    /// Short date format
    /// Format: "1/15/26"
    static let short: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none
        return formatter
    }()

    /// Long date with time
    /// Format: "January 15, 2026 at 3:30 PM"
    static let longWithTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        return formatter
    }()
}

// MARK: - Date Extension for Convenience
extension Date {
    /// Format this date for law display
    var lawDisplayFormat: String {
        DateFormatter.lawDisplay.string(from: self)
    }

    /// Format this date as relative time
    var relativeFormat: String {
        DateFormatter.relative.localizedString(for: self, relativeTo: Date())
    }

    /// Format this date as short format
    var shortFormat: String {
        DateFormatter.short.string(from: self)
    }

    /// Format this date with long format and time
    var longWithTimeFormat: String {
        DateFormatter.longWithTime.string(from: self)
    }
}
