// swift-tools-version: 5.9
// This is a Swift Package that allows Xcode to open the project directly
// Alternative to using XcodeGen

import PackageDescription

let package = Package(
    name: "MurphysLaws",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "MurphysLaws",
            targets: ["MurphysLaws"]
        )
    ],
    targets: [
        .target(
            name: "MurphysLaws",
            path: "MurphysLaws",
            resources: [
                .process("Assets.xcassets")
            ]
        ),
        .testTarget(
            name: "MurphysLawsTests",
            dependencies: ["MurphysLaws"],
            path: "MurphysLawsTests"
        ),
        .testTarget(
            name: "MurphysLawsUITests",
            dependencies: ["MurphysLaws"],
            path: "MurphysLawsUITests"
        )
    ]
)
