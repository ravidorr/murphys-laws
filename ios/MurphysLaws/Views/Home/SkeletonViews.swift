//
//  SkeletonViews.swift
//  MurphysLaws
//
//  Skeleton loading views for better UX
//

import SwiftUI

// MARK: - Skeleton Modifier
struct SkeletonModifier: ViewModifier {
    @State private var isAnimating = false

    // Skeleton placeholder uses DS.Color.mutedFg (web's --muted-fg /
    // --dark-muted-fg) at low alpha so the shimmer is visible without
    // dominating the layout. Asset Catalog pairs the light/dark variants
    // automatically; we no longer hand-branch on colorScheme.
    var baseColor: Color {
        DS.Color.mutedFg.opacity(DS.Opacity.skeletonBase)
    }

    var highlightColor: Color {
        DS.Color.mutedFg.opacity(DS.Opacity.skeletonHighlight)
    }
    
    func body(content: Content) -> some View {
        content
            .hidden()
            .overlay(
                LinearGradient(
                    colors: [
                        baseColor,
                        highlightColor,
                        baseColor
                    ],
                    startPoint: isAnimating ? .leading : .trailing,
                    endPoint: isAnimating ? .trailing : .leading
                )
                .mask(content)
            )
            .onAppear {
                withAnimation(.easeInOut(duration: DS.Motion.shimmerDuration).repeatForever(autoreverses: false)) {
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
        VStack(alignment: .leading, spacing: DS.Spacing.s4) {
            // Badge
            HStack {
                Circle()
                    .frame(
                        width: DS.Component.buttonIconSize,
                        height: DS.Component.buttonIconSize
                    )
                    .skeleton()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.widthLg,
                        height: DS.Layout.Skeleton.heightSm
                    )
                    .skeleton()
            }
            
            // Title placeholder
            RoundedRectangle(cornerRadius: DS.Radius.sm)
                .frame(height: DS.Layout.Skeleton.heightXl)
                .skeleton()
            
            RoundedRectangle(cornerRadius: DS.Radius.sm)
                .frame(
                    width: DS.Layout.Skeleton.width2xl,
                    height: DS.Layout.Skeleton.heightXl
                )
                .skeleton()
            
            // Text placeholder
            VStack(alignment: .leading, spacing: DS.Spacing.s2) {
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(height: DS.Layout.Skeleton.heightLg)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(height: DS.Layout.Skeleton.heightLg)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.width3xl,
                        height: DS.Layout.Skeleton.heightLg
                    )
                    .skeleton()
            }
            .padding(.vertical, DS.Spacing.s2)
            
            Divider()
            
            // Vote counts placeholder
            HStack {
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.widthSm,
                        height: DS.Layout.Skeleton.heightSm
                    )
                    .skeleton()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.widthSm,
                        height: DS.Layout.Skeleton.heightSm
                    )
                    .skeleton()
                
                Spacer()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.widthMd,
                        height: DS.Layout.Skeleton.heightSm
                    )
                    .skeleton()
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [
                    DS.Color.favoriteBg.opacity(DS.Opacity.strong),
                    DS.Color.orangeBg.opacity(DS.Opacity.medium)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(DS.Radius.xl)
        .shadow(
            color: DS.Color.shadowLight,
            radius: DS.Shadow.cardRadius,
            x: .zero,
            y: DS.Shadow.cardYOffset
        )
    }
}

// MARK: - Skeleton Law Card
struct SkeletonLawCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: DS.Spacing.s4) {
            // Title placeholder
            RoundedRectangle(cornerRadius: DS.Radius.sm)
                .frame(height: DS.Layout.Skeleton.heightMd)
                .skeleton()
            
            RoundedRectangle(cornerRadius: DS.Radius.sm)
                .frame(
                    width: DS.Layout.Skeleton.widthXl,
                    height: DS.Layout.Skeleton.heightMd
                )
                .skeleton()
            
            // Text placeholder
            VStack(
                alignment: .leading,
                spacing: DS.Layout.Skeleton.compactSpacing
            ) {
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(height: DS.Layout.Skeleton.heightSm)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(height: DS.Layout.Skeleton.heightSm)
                    .skeleton()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.width2xl,
                        height: DS.Layout.Skeleton.heightSm
                    )
                    .skeleton()
            }
            
            // Vote counts placeholder
            HStack {
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.widthXs,
                        height: DS.Layout.Skeleton.heightXs
                    )
                    .skeleton()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.widthXs,
                        height: DS.Layout.Skeleton.heightXs
                    )
                    .skeleton()
                
                Spacer()
                
                RoundedRectangle(cornerRadius: DS.Radius.sm)
                    .frame(
                        width: DS.Layout.Skeleton.widthMd,
                        height: DS.Layout.Skeleton.heightLg
                    )
                    .skeleton()
            }
        }
        .padding()
        .background(DS.Color.surface)
        .cornerRadius(DS.Radius.xl)
        .shadow(
            color: DS.Color.shadowSubtle,
            radius: DS.Shadow.smallRadius,
            x: .zero,
            y: DS.Shadow.smallYOffset
        )
    }
}

// MARK: - Previews
#Preview("Skeleton Law of Day Card") {
    SkeletonLawOfDayCard()
        .padding()
}

#Preview("Skeleton Law Card") {
    SkeletonLawCard()
        .frame(width: DS.Layout.contentRailWidth)
        .padding()
}
