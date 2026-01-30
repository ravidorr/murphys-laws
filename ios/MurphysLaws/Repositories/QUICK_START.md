# Quick Start: Configuration Setup

## Immediate Next Steps (5 minutes)

### 1. Verify Config.plist in Xcode
```
1. Open Xcode
2. Find Config.plist in Project Navigator
3. Right-click → Show File Inspector
4. Verify "Target Membership" includes your app target
5. Under "Build Phases" → "Copy Bundle Resources", ensure Config.plist is listed
```

### 2. Test Configuration Loading
Run your app and check the console for:
```
Config.plist not found. Using default values.
Using default API URL
```

If you see these warnings, Config.plist isn't being loaded properly.

### 3. Run Configuration Tests
```
⌘ + U (in Xcode)
```

Look for the "Configuration Tests" suite. It should show:
- API Base URL is loaded
- Environment configuration is loaded
- API Key handling
- Configuration values are accessible
- Log level is valid

### 4. Run Validation Script
```bash
chmod +x validate-config.sh
./validate-config.sh
```

### 5. Update Your Config.plist
Edit Config.plist and set your actual values:
- Set `Environment` to your current environment
- Update `APIBaseURL` if using a different endpoint
- Add `APIKey` if your API requires authentication
- Adjust `LogLevel` based on your needs

### 6. Test API Calls
Run your app and verify:
```swift
// Add this temporarily to test
print("Using API URL: \(Constants.API.baseURL)")
print("Environment: \(Constants.Environment.current)")
print("Log Level: \(Constants.Environment.logLevel)")
```

### 7. Verify .gitignore
```bash
git status
```

Make sure `Config.plist` does NOT appear in the list.

If it does:
```bash
git rm --cached Config.plist
git commit -m "Remove Config.plist from tracking"
```

## Common Issues & Fixes

### Issue: "Config.plist not found"
**Fix**:
1. Ensure Config.plist is in the project root (same directory as other Swift files)
2. Add it to your target in Xcode
3. Clean build folder (⌘ + Shift + K) and rebuild

### Issue: Changes to Config.plist not reflected
**Fix**:
1. Clean build folder (⌘ + Shift + K)
2. Delete derived data: ~/Library/Developer/Xcode/DerivedData
3. Rebuild (⌘ + B)

### Issue: Config.plist appears in git status
**Fix**:
```bash
# Remove from git tracking (keeps local file)
git rm --cached Config.plist

# Commit the removal
git commit -m "Remove Config.plist from version control"

# Verify .gitignore contains Config.plist
cat .gitignore | grep Config.plist
```

### Issue: API key not working
**Fix**:
1. Verify API key is not empty in Config.plist
2. Check if your API expects a different header name (modify APIService.swift)
3. Verify the key is valid with your backend team

## What Changed?

### Before:
```swift
// Hardcoded values
static let baseURL = "https://murphys-laws.com/api/v1"

// print statements everywhere
print("API failed")
```

### After:
```swift
// Dynamic configuration
static let baseURL: String = {
    // Loads from Config.plist
}()

// Professional logging
logWarning("API failed, falling back to mock data")
```

## Using the Logger

Replace your print statements:
```swift
// Old way
print("LawRepository.fetchLawDetail called for ID: \(id)")
print("API failed")

// New way
logDebug("LawRepository.fetchLawDetail called for ID: \(id)")
logWarning("API failed, falling back to mock data")
```

Log levels filter automatically based on Config.plist:
- `debug` → Shows everything
- `info` → Shows info, warning, error
- `warning` → Shows warning, error
- `error` → Shows only errors

## Ready to Commit?

Once everything works:

```bash
# Stage all configuration files
git add Config.plist.template
git add .gitignore
git add Constants.swift
git add APIService.swift
git add LawRepository.swift
git add Logger.swift
git add ConfigurationTests.swift
git add CONFIG_README.md
git add CONFIGURATION_SUMMARY.md
git add QUICK_START.md
git add validate-config.sh

# Commit
git commit -m "feat: Implement configuration management system

- Add Config.plist for environment-specific settings
- Enhance Constants with dynamic configuration loading  
- Add Logger with configurable log levels
- Update APIService to support API keys
- Create validation script and documentation
- Add configuration tests
- Update LawRepository to use new logging system"

# Push
git push
```

## Need Help?

Check these files:
- **CONFIG_README.md** - Full documentation
- **CONFIGURATION_SUMMARY.md** - What was implemented
- **Config.plist.template** - Configuration template

Run validation:
```bash
./validate-config.sh
```
