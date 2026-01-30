# Visual Guide: Fixing Info.plist Duplicate Error

## The Error You're Seeing

```
Multiple commands produce '.../MurphysLaws.app/Info.plist'
duplicate output file '.../Info.plist' on task: ProcessInfoPlistFile
```

## What This Means

Xcode is trying to process `Info.plist` **twice** during the build, creating a conflict.

## Most Common Cause (95% of cases)

**Info.plist is in the wrong place**: It's listed in "Copy Bundle Resources" where it shouldn't be.

---

## Quick Fix (2 minutes)

### Step 1: Open Build Phases

```
Xcode Project Navigator (left sidebar)
    └── Click "MurphysLaws" (blue icon at top)
        └── Select "MurphysLaws" target (under TARGETS)
            └── Click "Build Phases" tab (top)
```

### Step 2: Find Copy Bundle Resources

```
Build Phases
    ├── Dependencies
    ├── Compile Sources (XX items)
    ├── Link Binary With Libraries (XX items)
    └── Copy Bundle Resources (XX items) ← EXPAND THIS
```

### Step 3: Look for Info.plist

Inside "Copy Bundle Resources", you'll see a list like:

```
Copy Bundle Resources (8 items)
    ├── Assets.xcassets              Keep
    ├── Config.plist                 Keep (we just added this!)
    ├── Info.plist                   REMOVE THIS!!!
    ├── LaunchScreen.storyboard      Keep
    └── ...other files               Keep
```

### Step 4: Remove Info.plist

1. **Click on "Info.plist"** in the list
2. **Press the minus (-) button** at the bottom right
3. Or **right-click → Delete**

### Step 5: Verify Config.plist is There

Make sure `Config.plist` **IS** in "Copy Bundle Resources" (we just added it):

```
Copy Bundle Resources
    ├── Config.plist Should be here
    ├── Assets.xcassets
    └── Other files...
```

### Step 6: Clean and Build

```
⌘ + Shift + K  (Clean Build Folder)
⌘ + B          (Build)
```

---

## Why This Happens

### Info.plist vs Config.plist

| File | Where it Goes | Why |
|------|---------------|-----|
| **Info.plist** | Build Settings ONLY | Processed by Xcode into app metadata |
| **Config.plist** | Copy Bundle Resources | Needs to be accessible at runtime |

### What You Did Wrong (Probably)

When adding `Config.plist`, you might have accidentally:
1. Dragged `Info.plist` along with `Config.plist`
2. Selected both files when adding to target
3. Xcode auto-added Info.plist (shouldn't happen, but can)

### Correct Setup

```
Build Settings
    └── Packaging
        └── Info.plist File: "MurphysLaws/Info.plist"
            (This tells Xcode where Info.plist is)

Build Phases
    └── Copy Bundle Resources
        ├── Config.plist
        ├── Assets
        └── NOT Info.plist
```

---

## Verification Steps

### After Removing Info.plist:

1. **Check File Inspector**
   - Select `Info.plist` in Project Navigator
   - Open File Inspector (right sidebar, ⌘ + ⌥ + 1)
   - Under "Target Membership": Should be **unchecked** or not listed

2. **Check Config.plist**
   - Select `Config.plist` in Project Navigator
   - File Inspector → Target Membership: Should be **checked**

3. **Build Should Succeed**
   - ⌘ + B
   - No errors about duplicate Info.plist

---

## If Problem Persists

### Try: Delete Derived Data

```bash
# Close Xcode first!

# Delete derived data for this project
rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*

# Reopen Xcode
# Clean (⌘ + Shift + K)
# Build (⌘ + B)
```

### Try: Run Diagnostic Script

```bash
chmod +x diagnose-infoplist.sh
./diagnose-infoplist.sh
```

This will tell you exactly what's wrong.

### Try: Check for Duplicate Targets

Sometimes you have multiple targets and Info.plist is duplicated:

```
TARGETS
    ├── MurphysLaws (App)        ← Check this one
    ├── MurphysLawsTests         ← And this one
    └── MurphysLawsUITests       ← And this one
```

For **each target**, verify:
- Build Phases → Copy Bundle Resources → No Info.plist

---

## Checklist

- [ ] Info.plist is NOT in Copy Bundle Resources
- [ ] Config.plist IS in Copy Bundle Resources
- [ ] Build Settings → Info.plist File points to correct path
- [ ] Clean Build Folder (⌘ + Shift + K)
- [ ] Build succeeds (⌘ + B)
- [ ] No duplicate Info.plist errors

---

## Understanding the Error

### What Xcode Does with Info.plist:

1. **Build Settings** tells Xcode: "Process this Info.plist file"
2. Xcode runs: `ProcessInfoPlistFile` command
3. Output: Processed Info.plist in app bundle

### What Goes Wrong:

```
Build Settings says: "Process Info.plist" 
                     ↓
            ProcessInfoPlistFile runs
                     ↓
            Output: MurphysLaws.app/Info.plist

Copy Bundle Resources says: "Copy Info.plist"
                     ↓
            Copy command runs
                     ↓
            Output: MurphysLaws.app/Info.plist

CONFLICT! Two commands trying to create same file!
```

### The Fix:

```
Build Settings: Process Info.plist
Copy Bundle Resources: NO Info.plist

Result: Only ONE Info.plist in app bundle
```

---

## TL;DR (Too Long; Didn't Read)

1. **Open Xcode**
2. **Target → Build Phases → Copy Bundle Resources**
3. **Remove Info.plist** (press minus button)
4. **Keep Config.plist** in that list
5. **Clean + Build** (⌘ + Shift + K, then ⌘ + B)
6. **Done!**

---

## Need More Help?

1. **Run diagnostic**: `./diagnose-infoplist.sh`
2. **Read detailed fix**: See `INFO_PLIST_FIX.md`
3. **Still broken?** Check if you have custom build scripts processing Info.plist

---

## After Fixing

Your build should show:
```
Build Succeeded
No duplicate Info.plist errors  
App runs normally
Config.plist loads correctly
```

You can verify Config.plist works by running the configuration tests:
```
⌘ + U (Run Tests)
```

Look for "Configuration Tests" suite - all tests should pass!
