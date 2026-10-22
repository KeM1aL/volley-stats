// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.3"),
        .package(name: "CapacitorCommunityKeepAwake", path: "../../../node_modules/.pnpm/@capacitor-community+keep-awake@8.0.1_@capacitor+core@8.5.3/node_modules/@capacitor-community/keep-awake"),
        .package(name: "CapacitorApp", path: "../../../node_modules/.pnpm/@capacitor+app@8.1.2_@capacitor+core@8.5.3/node_modules/@capacitor/app"),
        .package(name: "CapacitorDevice", path: "../../../node_modules/.pnpm/@capacitor+device@8.0.3_@capacitor+core@8.5.3/node_modules/@capacitor/device"),
        .package(name: "CapacitorFilesystem", path: "../../../node_modules/.pnpm/@capacitor+filesystem@8.1.5_@capacitor+core@8.5.3/node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorHaptics", path: "../../../node_modules/.pnpm/@capacitor+haptics@8.0.2_@capacitor+core@8.5.3/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorNetwork", path: "../../../node_modules/.pnpm/@capacitor+network@8.0.1_@capacitor+core@8.5.3/node_modules/@capacitor/network"),
        .package(name: "CapacitorPreferences", path: "../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.5.3/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorShare", path: "../../../node_modules/.pnpm/@capacitor+share@8.0.3_@capacitor+core@8.5.3/node_modules/@capacitor/share")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityKeepAwake", package: "CapacitorCommunityKeepAwake"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorNetwork", package: "CapacitorNetwork"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorShare", package: "CapacitorShare")
            ]
        )
    ]
)
