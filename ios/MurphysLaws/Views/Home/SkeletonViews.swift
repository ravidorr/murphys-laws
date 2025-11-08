//
//  SkeletonViews.swift
//  MurphysLaws
//
//  Skeleton loading views for better UX
//

import SwiftUI

// MARK: - Skeleton Modifier
struct SkeletonModifier: ViewModifier {
    @Environment(\.colorScheme) var colorScheme
    @State private var isAnimating = false
    
    var baseColor: Color {
        colorScheme == .dark 
            ? Color(white: 0.25) // Darker gray for dark mode
            : Color(white: 0.85) // Lighter gray for light mode
    }
    
    var highlightColor: Color {
        colorScheme == .dark
            ? Color(white: 0.35) // Slightly lighter for shimmer in dark mode
            : Color(white: 0.95) // Slightly lighter for shimmer in light mode
    }
    
    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: [
                                baseColor,
                                highlightColor,
                                baseColor
                            ],
                            startPoint: isAnimating ? .leading : .trailing,
                            endPoint: isAnimating ? .trailing : .leading
                        )
                    )
            )
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: false)) {
                    isAnimating = true
                }
            }
    }
}

extension View {
    func skeleton() -> some View {
        self.modifier(SkeletonModifier())
    }
}

// MARK: - Skeleton Law of Day Card
struct SkeletonLawOfDayCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
            // Badge
            HStack {
                Circle()
                    .frame(width: 20, height: 20)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 120, height: 16)
                    .skeleton()
            }
            
            // Title placeholder
            RoundedRectangle(cornerRadius: 4)
                .frame(height: 28)
                .skeleton()
            
            RoundedRectangle(cornerRadius: 4)
                .frame(width: 200, height: 28)
                .skeleton()
            
            // Text placeholder
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4)
                    .frame(height: 20)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(height: 20)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 250, height: 20)
                    .skeleton()
            }
            .padding(.vertical, Constants.UI.spacingS)
            
            Divider()
            
            // Vote counts placeholder
            HStack {
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 60, height: 16)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 60, height: 16)
                    .skeleton()
                
                Spacer()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 80, height: 16)
                    .skeleton()
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Color.yellow.opacity(0.1), Color.orange.opacity(0.05)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(Constants.UI.cornerRadiusL)
        .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
    }
}

// MARK: - Skeleton Law Card
struct SkeletonLawCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
            // Title placeholder
            RoundedRectangle(cornerRadius: 4)
                .frame(height: 18)
                .skeleton()
            
            RoundedRectangle(cornerRadius: 4)
                .frame(width: 150, height: 18)
                .skeleton()
            
            // Text placeholder
            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 4)
                    .frame(height: 16)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(height: 16)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 200, height: 16)
                    .skeleton()
            }
            
            // Vote counts placeholder
            HStack {
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 50, height: 14)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 50, height: 14)
                    .skeleton()
                
                Spacer()
                
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 80, height: 20)
                    .skeleton()
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(Constants.UI.cornerRadiusM)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Previews
#Preview("Skeleton Law of Day Card") {
    SkeletonLawOfDayCard()
        .padding()
}

#Preview("Skeleton Law Card") {
    SkeletonLawCard()
        .frame(width: 300)
        .padding()
}
