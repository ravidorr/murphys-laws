# iOS App Setup Instructions

## ✨ Easiest: Open Swift Package (No Installation Required!)

**Just double-click `Package.swift` in Finder, or run:**

```bash
cd ios
open Package.swift
```

**Xcode will open immediately with all 25 Swift files visible!**

This works great for development and testing. For App Store submission, use Option 2 below.

---

## Option 2: Generate Full Xcode Project (Recommended for App Store)

**On your Mac, run these commands:**

```bash
# Navigate to the iOS directory
cd ios

# Install XcodeGen (one-time setup)
brew install xcodegen

# Generate the Xcode project
xcodegen generate

# Open in Xcode
open MurphysLaws.xcodeproj
```

This creates a proper iOS App project ready for App Store submission.

---

## Option 3: Manual Setup in Xcode

If you prefer not to use XcodeGen:

1. **Open Xcode** and select "Create a new Xcode project"
2. Choose **iOS > App** template
3. Configure the project:
   - Product Name: `MurphysLaws`
   - Team: Your development team
   - Organization Identifier: `com.murphyslaws`
   - Interface: **SwiftUI**
   - Language: **Swift**
4. **Save location**: Navigate to the `murphys-laws/ios/` directory
5. **Important**: When saving, choose "Don't create Git repository" (it already exists)
6. In Xcode's Project Navigator, you should now see the folder structure

7. **Add existing files**:
   - Delete the default `ContentView.swift` and `MurphysLawsApp.swift` that Xcode created
   - In Xcode, right-click on `MurphysLaws` folder
   - Select "Add Files to MurphysLaws..."
   - Navigate to the `MurphysLaws` folder with all the source files
   - Select all folders (App, Models, Views, ViewModels, Services, Repositories, Utilities)
   - **Important options**:
     - ✅ Create groups
     - ✅ Add to target: MurphysLaws
     - ❌ Copy items if needed (leave unchecked)
   - Click "Add"

8. **Add test targets**:
   - Right-click on the project root
   - Select "Add Files to MurphysLaws..."
   - Add the `MurphysLawsTests` folder
   - Add the `MurphysLawsUITests` folder
   - Ensure they're added to their respective test targets

9. **Configure Info.plist**:
   - The Info.plist file is already created at `MurphysLaws/Info.plist`
   - In Project Settings > General, ensure the Info.plist path is set to `MurphysLaws/Info.plist`

10. **Configure Assets**:
    - Replace the default `Assets.xcassets` with the one in `MurphysLaws/Assets.xcassets`

## Verify Setup

Press **⌘B** to build. You should see:
- 25 Swift source files compiled
- No build errors
- Ready to run on simulator

## Troubleshooting

**"File not found" errors**: Ensure files were added with "Create groups" not "Create folder references"

**Info.plist errors**: Check that Build Settings > Info.plist File is set to `MurphysLaws/Info.plist`

**Missing assets**: Verify Assets.xcassets is in the target membership

## Getting Help

If you encounter issues, check:
- [SETUP.md](./SETUP.md) for detailed setup instructions
- [README.md](./README.md) for architecture overview
