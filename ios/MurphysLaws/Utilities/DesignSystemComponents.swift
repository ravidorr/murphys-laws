//
//  DesignSystemComponents.swift
//  MurphysLaws
//
//  Canonical SwiftUI components backed by generated DS tokens.
//

import SwiftUI

extension DS {
    enum Border {
        static let standard: CGFloat = 1
        static let strong: CGFloat = 2
    }

    enum Opacity {
        static let faint = 0.1
        static let subtle = 0.15
        static let skeletonBase = 0.18
        static let soft = 0.2
        static let muted = 0.3
        static let skeletonHighlight = 0.32
        static let medium = 0.5
        static let strong = 0.7
    }

    enum Motion {
        static let controlFeedbackDuration = 0.15
        static let shimmerDuration = 1.5
    }

    enum Shadow {
        static let cardRadius: CGFloat = 8
        static let cardYOffset: CGFloat = 4
        static let smallRadius: CGFloat = 4
        static let smallYOffset: CGFloat = 2
    }

    enum Layout {
        static let valueLabelWidth: CGFloat = 30
        static let thumbnailSize: CGFloat = 100
        static let contentRailWidth: CGFloat = 300

        enum Skeleton {
            static let compactSpacing: CGFloat = 6
            static let heightXs: CGFloat = 14
            static let heightSm: CGFloat = 16
            static let heightMd: CGFloat = 18
            static let heightLg: CGFloat = 20
            static let heightXl: CGFloat = 28
            static let widthXs: CGFloat = 50
            static let widthSm: CGFloat = 60
            static let widthMd: CGFloat = 80
            static let widthLg: CGFloat = 120
            static let widthXl: CGFloat = 150
            static let width2xl: CGFloat = 200
            static let width3xl: CGFloat = 250
        }
    }
}

enum DSButtonVariant {
    case primary
    case secondary
}

struct DSButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    let variant: DSButtonVariant

    init(_ variant: DSButtonVariant = .primary) {
        self.variant = variant
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .dsTypography(DS.Typography.bodyMd)
            .frame(maxWidth: .infinity)
            .frame(minHeight: DS.Component.controlMinSize)
            .padding(.horizontal, DS.Spacing.s4)
            .background(backgroundColor)
            .foregroundStyle(foregroundColor)
            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.lg))
            .overlay {
                RoundedRectangle(cornerRadius: DS.Radius.lg)
                    .stroke(borderColor, lineWidth: DS.Border.standard)
            }
            .opacity(controlOpacity(configuration))
            .animation(
                reduceMotion ? nil : .easeOut(duration: DS.Motion.controlFeedbackDuration),
                value: configuration.isPressed
            )
    }

    private func controlOpacity(_ configuration: Configuration) -> Double {
        if !isEnabled { return DS.Opacity.medium }
        return configuration.isPressed ? DS.Opacity.strong : 1
    }

    private var backgroundColor: Color {
        variant == .primary ? DS.Color.btnPrimaryBg : DS.Color.surface
    }

    private var foregroundColor: Color {
        variant == .primary ? DS.Color.btnPrimaryFg : DS.Color.fg
    }

    private var borderColor: Color {
        variant == .primary ? DS.Color.btnPrimaryBg : DS.Color.surfaceBorder
    }
}

struct DSIconButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(
                width: DS.Component.iconButtonSize,
                height: DS.Component.iconButtonSize
            )
            .foregroundStyle(DS.Color.fg)
            .background(DS.Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.lg))
            .overlay {
                RoundedRectangle(cornerRadius: DS.Radius.lg)
                    .stroke(DS.Color.surfaceBorder, lineWidth: DS.Border.standard)
            }
            .opacity(controlOpacity(configuration))
            .animation(
                reduceMotion ? nil : .easeOut(duration: DS.Motion.controlFeedbackDuration),
                value: configuration.isPressed
            )
    }

    private func controlOpacity(_ configuration: Configuration) -> Double {
        if !isEnabled { return DS.Opacity.medium }
        return configuration.isPressed ? DS.Opacity.strong : 1
    }
}

struct DSVoteButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    let color: Color
    let isSelected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .frame(minHeight: DS.Component.controlMinSize)
            .padding(DS.Spacing.s4)
            .background(isSelected ? color.opacity(DS.Opacity.faint) : DS.Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.lg))
            .overlay {
                RoundedRectangle(cornerRadius: DS.Radius.lg)
                    .stroke(isSelected ? color : DS.Color.surfaceBorder, lineWidth: DS.Border.standard)
            }
            .opacity(controlOpacity(configuration))
            .animation(
                reduceMotion ? nil : .easeOut(duration: DS.Motion.controlFeedbackDuration),
                value: configuration.isPressed
            )
    }

    private func controlOpacity(_ configuration: Configuration) -> Double {
        if !isEnabled { return DS.Opacity.medium }
        return configuration.isPressed ? DS.Opacity.strong : 1
    }
}

private struct DSCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(DS.Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.xl))
            .overlay {
                RoundedRectangle(cornerRadius: DS.Radius.xl)
                    .stroke(DS.Color.surfaceBorder, lineWidth: DS.Border.standard)
            }
    }
}

private struct DSFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .frame(minHeight: DS.Component.controlMinSize)
            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.lg))
    }
}

private struct DSControlTargetModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.frame(minWidth: DS.Component.controlMinSize, minHeight: DS.Component.controlMinSize)
    }
}

extension View {
    func dsCard() -> some View {
        modifier(DSCardModifier())
    }

    func dsField() -> some View {
        modifier(DSFieldModifier())
    }

    func dsControlTarget() -> some View {
        modifier(DSControlTargetModifier())
    }

    func dsSlider() -> some View {
        self
            .frame(minHeight: DS.Component.controlMinSize)
            .tint(DS.Color.btnPrimaryBg)
    }
}

struct DSHeading: View {
    let text: String
    let level: DS.Typography.Level

    init(_ text: String, level: DS.Typography.Level = DS.Typography.h2) {
        self.text = text
        self.level = level
    }

    var body: some View {
        Text(text)
            .dsTypography(level)
            .foregroundStyle(DS.Color.fg)
            .accessibilityAddTraits(.isHeader)
    }
}

struct DSBrandBadge: View {
    var body: some View {
        Text("M")
            .dsTypography(DS.Typography.h3)
            .foregroundStyle(DS.Color.btnPrimaryFg)
            .frame(
                width: DS.Component.brandBadgeSize,
                height: DS.Component.brandBadgeSize
            )
            .background(DS.Color.primary)
            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.md))
            .accessibilityHidden(true)
    }
}

struct DSMessage: View {
    enum Tone {
        case success
        case error
    }

    let text: String
    let tone: Tone

    var body: some View {
        Text(text)
            .dsTypography(DS.Typography.bodySm)
            .foregroundStyle(tone == .success ? DS.Color.successText : DS.Color.errorText)
            .padding(DS.Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tone == .success ? DS.Color.successBg : DS.Color.errorBg)
            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.xl))
    }
}
