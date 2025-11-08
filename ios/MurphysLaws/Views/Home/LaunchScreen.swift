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
            Color(uiColor: .systemBackground)
                .ignoresSafeArea()
            
            VStack(spacing: 24) {
                // App Icon or Logo
                Image(systemName: "bolt.trianglebadge.exclamationmark.fill")
                    .font(.system(size: 80))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.orange, .red],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .symbolRenderingMode(.hierarchical)
                
                // App Name
                VStack(spacing: 8) {
                    Text("Murphy's Laws")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.primary)
                    
                    Text("If anything can go wrong, it will")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .italic()
                }
            }
        }
    }
}

#Preview {
    LaunchScreenView()
}
