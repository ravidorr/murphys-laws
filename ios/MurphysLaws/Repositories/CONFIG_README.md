# Murphy's Laws Configuration

## Setup Instructions

### 1. Create Your Config.plist

Copy the template file to create your own configuration:

```bash
cp Config.plist.template Config.plist
```

### 2. Configure Your Environment

Edit `Config.plist` with your specific settings:

- **Environment**: Set to `development`, `staging`, or `production`
- **APIBaseURL**: The base URL for the API (default: `https://murphys-laws.com/api/v1`)
- **APIKey**: Your API key (leave empty if not required)
- **EnableAnalytics**: Enable/disable analytics tracking
- **EnableCrashReporting**: Enable/disable crash reporting
- **LogLevel**: Set logging verbosity (`debug`, `info`, `warning`, `error`)

### 3. Configuration Values

#### Environment Options

- `development`: Local development with verbose logging
- `staging`: Pre-production testing environment
- `production`: Live production environment

#### Log Levels

- `debug`: All logs including detailed debugging information
- `info`: General information and important events
- `warning`: Warning messages only
- `error`: Error messages only

### 4. Security Notes

**IMPORTANT**: `Config.plist` is in `.gitignore` and should **NEVER** be committed to version control.

- Keep your API keys secure
- Don't share your `Config.plist` file
- Use environment-specific keys for different environments
- Rotate keys regularly

### 5. Accessing Configuration in Code

Configuration values are accessed through the `Constants` enum:

```swift
// Environment
Constants.Environment.current          // "development" | "staging" | "production"
Constants.Environment.isDevelopment    // Bool
Constants.Environment.isProduction     // Bool
Constants.Environment.enableAnalytics  // Bool
Constants.Environment.logLevel         // String

// API
Constants.API.baseURL                  // String
Constants.API.apiKey                   // String?
```

### 6. Xcode Integration

Make sure `Config.plist` is added to your target's "Copy Bundle Resources" build phase:

1. Open your project in Xcode
2. Select your target
3. Go to "Build Phases"
4. Expand "Copy Bundle Resources"
5. Ensure `Config.plist` is listed (not `Config.plist.template`)

### 7. Different Configurations for Different Schemes

For advanced setups with multiple environments, you can:

1. Create multiple scheme-specific plist files:
   - `Config-Development.plist`
   - `Config-Staging.plist`
   - `Config-Production.plist`

2. Use Xcode schemes to switch between them
3. Update the configuration loader in `Constants.swift` to check the scheme

### 8. Troubleshooting

**Problem**: App crashes or uses wrong API URL
- **Solution**: Verify `Config.plist` exists and is in your bundle resources

**Problem**: Changes to `Config.plist` not reflected
- **Solution**: Clean build folder (Cmd+Shift+K) and rebuild

**Problem**: Configuration file not found
- **Solution**: Check that `Config.plist` is in the same directory as your source files and added to your target

## Example Config.plist

See `Config.plist.template` for a complete example.

## CI/CD Integration

For CI/CD pipelines, create `Config.plist` from environment variables:

```bash
#!/bin/bash
cat > Config.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Environment</key>
    <string>${ENVIRONMENT}</string>
    <key>APIBaseURL</key>
    <string>${API_BASE_URL}</string>
    <key>APIKey</key>
    <string>${API_KEY}</string>
    <key>EnableAnalytics</key>
    <${ENABLE_ANALYTICS}/>
    <key>EnableCrashReporting</key>
    <${ENABLE_CRASH_REPORTING}/>
    <key>LogLevel</key>
    <string>${LOG_LEVEL}</string>
</dict>
</plist>
EOF
```
