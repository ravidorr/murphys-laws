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
                DSBrandBadge()
                
                // App Name
                VStack(spacing: DS.Spacing.s2) {
                    DSHeading("Murphy's Laws")
                    
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
