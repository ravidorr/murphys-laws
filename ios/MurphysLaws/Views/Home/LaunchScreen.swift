//
//  LaunchScreen.swift
//  MurphysLaws
//
//  Custom launch screen content
//

import SwiftUI

struct LaunchScreenView: View {
    var body: some View {
        ZStack {
            DS.Color.bg
                .ignoresSafeArea()
            
            VStack(spacing: DS.Spacing.s6) {
                // App Icon or Logo
                Image(systemName: "bolt.trianglebadge.exclamationmark.fill")
                    .dsTypography(DS.Typography.display)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [DS.Color.orangeText, DS.Color.error],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .symbolRenderingMode(.hierarchical)
                
                // App Name
                VStack(spacing: DS.Spacing.s2) {
                    Text("Murphy's Laws")
                        .dsTypography(DS.Typography.h2)
                        .foregroundColor(DS.Color.fg)
                    
                    Text("If anything can go wrong, it will")
                        .dsTypography(DS.Typography.bodySm)
                        .foregroundColor(DS.Color.mutedFg)
                        .italic()
                }
            }
        }
    }
}

#Preview {
    LaunchScreenView()
}
