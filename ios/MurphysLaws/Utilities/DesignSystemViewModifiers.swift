//
//  DesignSystemViewModifiers.swift
//  MurphysLaws
//
//  Hand-authored SwiftUI helpers for applying generated DS tokens.
//

import SwiftUI

extension View {
    func dsTypography(_ level: DS.Typography.Level) -> some View {
        self
            .font(level.font)
            .lineSpacing(level.lineSpacing)
            .tracking(level.letterSpacing ?? 0)
    }
}
