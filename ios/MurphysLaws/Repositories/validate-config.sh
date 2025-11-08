#!/bin/bash

# Configuration Validation Script
# Run this to ensure Config.plist is properly set up

echo "🔍 Validating Murphy's Laws Configuration..."
echo ""

# Check if Config.plist exists
if [ ! -f "Config.plist" ]; then
    echo "❌ Config.plist not found!"
    echo ""
    echo "Please create it from the template:"
    echo "  cp Config.plist.template Config.plist"
    echo ""
    exit 1
fi

echo "✅ Config.plist exists"

# Check if it's not just the template
if grep -q "YOUR_API_KEY_HERE" Config.plist; then
    echo "⚠️  Config.plist still contains template values"
    echo "   Please update APIKey in Config.plist"
    echo ""
fi

# Validate XML structure
if plutil -lint Config.plist > /dev/null 2>&1; then
    echo "✅ Config.plist has valid XML structure"
else
    echo "❌ Config.plist has invalid XML structure"
    plutil -lint Config.plist
    exit 1
fi

# Extract and display values
echo ""
echo "📋 Current Configuration:"
echo "------------------------"

ENVIRONMENT=$(/usr/libexec/PlistBuddy -c "Print :Environment" Config.plist 2>/dev/null)
API_URL=$(/usr/libexec/PlistBuddy -c "Print :APIBaseURL" Config.plist 2>/dev/null)
API_KEY=$(/usr/libexec/PlistBuddy -c "Print :APIKey" Config.plist 2>/dev/null)
ANALYTICS=$(/usr/libexec/PlistBuddy -c "Print :EnableAnalytics" Config.plist 2>/dev/null)
CRASH=$(/usr/libexec/PlistBuddy -c "Print :EnableCrashReporting" Config.plist 2>/dev/null)
LOG_LEVEL=$(/usr/libexec/PlistBuddy -c "Print :LogLevel" Config.plist 2>/dev/null)

echo "Environment:          $ENVIRONMENT"
echo "API Base URL:         $API_URL"
if [ -n "$API_KEY" ] && [ "$API_KEY" != "YOUR_API_KEY_HERE" ]; then
    echo "API Key:              [CONFIGURED]"
else
    echo "API Key:              [NOT SET]"
fi
echo "Analytics Enabled:    $ANALYTICS"
echo "Crash Reporting:      $CRASH"
echo "Log Level:            $LOG_LEVEL"

echo ""

# Validate environment value
if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "⚠️  Invalid environment value: $ENVIRONMENT"
    echo "   Should be: development, staging, or production"
    echo ""
fi

# Validate log level
if [ "$LOG_LEVEL" != "debug" ] && [ "$LOG_LEVEL" != "info" ] && [ "$LOG_LEVEL" != "warning" ] && [ "$LOG_LEVEL" != "error" ]; then
    echo "⚠️  Invalid log level: $LOG_LEVEL"
    echo "   Should be: debug, info, warning, or error"
    echo ""
fi

# Check if in .gitignore
if grep -q "Config.plist" .gitignore 2>/dev/null; then
    echo "✅ Config.plist is in .gitignore"
else
    echo "⚠️  Config.plist is NOT in .gitignore"
    echo "   Add it to prevent committing sensitive data!"
    echo ""
fi

# Check git status
if git ls-files --error-unmatch Config.plist > /dev/null 2>&1; then
    echo "❌ Config.plist is tracked by git!"
    echo ""
    echo "Remove it from git tracking:"
    echo "  git rm --cached Config.plist"
    echo "  git commit -m \"Remove Config.plist from tracking\""
    echo ""
else
    echo "✅ Config.plist is not tracked by git"
fi

echo ""
echo "✨ Configuration validation complete!"
