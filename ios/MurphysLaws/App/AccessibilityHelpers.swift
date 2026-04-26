//
//  AccessibilityHelpers.swift
//  MurphysLaws
//
//  Accessibility utilities and extensions
//

import SwiftUI

// MARK: - Accessibility Labels
enum AccessibilityLabels {
    // Law Actions
    static let upvote = "Upvote this law"
    static let downvote = "Downvote this law"
    static let shareLaw = "Share this law"
    static let viewDetails = "View law details"

    // Navigation
    static let backButton = "Back"
    static let closeButton = "Close"

    // Calculator
    static func sliderLabel(name: String, value: Int) -> String {
        "\(name) slider, current value \(value) out of 10"
    }

    static func riskLevel(_ level: String) -> String {
        "Risk level: \(level)"
    }

    // Vote counts
    static func voteCount(upvotes: Int, downvotes: Int, score: Int) -> String {
        "\(upvotes) upvotes, \(downvotes) downvotes, score \(score)"
    }
}

// MARK: - Accessibility Hints
enum AccessibilityHints {
    static let upvote = "Double tap to upvote"
    static let downvote = "Double tap to downvote"
    static let selectCategory = "Double tap to select this category"
    static let viewLaw = "Double tap to view full law details"
}

// MARK: - Dynamic Type Support
extension Font {
    /// Get a scalable font that respects Dynamic Type
    static func scalable(_ textStyle: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(textStyle, design: .default, weight: weight)
    }
}

// MARK: - View Extension for Accessibility
extension View {
    /// Add comprehensive accessibility support to buttons
    func accessibleButton(
        label: String,
        hint: String? = nil,
        traits: AccessibilityTraits = []
    ) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
            .accessibilityAddTraits(traits)
    }

    /// Mark as a heading for VoiceOver navigation
    func accessibleHeading() -> some View {
        self.accessibilityAddTraits(.isHeader)
    }

    /// Group child elements for VoiceOver
    func accessibleGroup(label: String? = nil) -> some View {
        self
            .accessibilityElement(children: .combine)
            .if(label != nil) { view in
                view.accessibilityLabel(label!)
            }
    }
}

// MARK: - Conditional View Modifier
extension View {
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Accessibility-Friendly Loading Indicator
struct AccessibleLoadingView: View {
    let message: String

    var body: some View {
        VStack(spacing: Constants.UI.spacingM) {
            ProgressView()
                .scaleEffect(1.5)
            Text(message)
                .dsTypography(DS.Typography.bodyMd)
                .foregroundColor(DS.Color.mutedFg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message)
    }
}

// MARK: - High Contrast Support
@available(iOS 14.0, *)
struct HighContrastModifier: ViewModifier {
    @Environment(\.colorSchemeContrast) var colorSchemeContrast

    let normalColor: Color
    let highContrastColor: Color

    func body(content: Content) -> some View {
        content
            .foregroundColor(colorSchemeContrast == .increased ? highContrastColor : normalColor)
    }
}

extension View {
    /// Apply different colors based on accessibility contrast settings
    func adaptiveContrast(normal: Color, highContrast: Color) -> some View {
        if #available(iOS 14.0, *) {
            return AnyView(self.modifier(HighContrastModifier(normalColor: normal, highContrastColor: highContrast)))
        } else {
            return AnyView(self.foregroundColor(normal))
        }
    }
}

// MARK: - Reduce Motion Support
struct ReduceMotionModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) var reduceMotion

    let animation: Animation

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.animation(animation, value: UUID())
        }
    }
}

extension View {
    /// Conditionally animate based on reduce motion setting
    func respectReduceMotion(_ animation: Animation) -> some View {
        self.modifier(ReduceMotionModifier(animation: animation))
    }
}

#Preview {
    VStack(spacing: 20) {
        AccessibleLoadingView(message: "Loading laws...")

        Button("Sample Button") {
            print("Tapped")
        }
        .accessibleButton(
            label: "Sample action button",
            hint: "Double tap to perform action"
        )

        Text("Heading Text")
            .dsTypography(DS.Typography.h2)
            .accessibleHeading()
    }
    .padding()
}
