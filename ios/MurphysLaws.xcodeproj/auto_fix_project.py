#!/usr/bin/env python3
"""
Auto-fix script for MurphysLaws UI Tests linker errors
This script modifies the Xcode project.pbxproj file to remove incorrect target memberships
"""

import os
import sys
import re
import shutil
from datetime import datetime

PROJECT_DIR = "/Users/ravidor/personal-dev/murphys-laws/ios"
PROJECT_FILE = os.path.join(PROJECT_DIR, "MurphysLaws.xcodeproj", "project.pbxproj")

def backup_project():
    """Create a backup of the project file"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"{PROJECT_FILE}.backup.{timestamp}"
    shutil.copy2(PROJECT_FILE, backup_file)
    print(f"✅ Backup created: {backup_file}")
    return backup_file

def read_project_file():
    """Read the project.pbxproj file"""
    if not os.path.exists(PROJECT_FILE):
        print(f"❌ Error: Project file not found at {PROJECT_FILE}")
        sys.exit(1)
    
    with open(PROJECT_FILE, 'r', encoding='utf-8') as f:
        return f.read()

def write_project_file(content):
    """Write the modified content back to project.pbxproj"""
    with open(PROJECT_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

def find_target_id(content, target_name):
    """Find the target ID for a given target name"""
    pattern = rf'/\* {re.escape(target_name)} \*/ = \{{[^}}]*isa = PBXNativeTarget;[^}}]*name = {re.escape(target_name)};'
    match = re.search(pattern, content)
    if match:
        # Extract the ID which appears before the comment
        id_pattern = r'([A-F0-9]{24}) /\* ' + re.escape(target_name)
        id_match = re.search(id_pattern, content)
        if id_match:
            return id_match.group(1)
    return None

def find_file_reference_id(content, filename):
    """Find the file reference ID for a given filename"""
    pattern = rf'([A-F0-9]{{24}}) /\* {re.escape(filename)} \*/ = \{{[^}}]*isa = PBXFileReference'
    match = re.search(pattern, content)
    if match:
        return match.group(1)
    return None

def remove_file_from_target(content, file_id, target_id):
    """Remove a file reference from a specific target's sources"""
    if not file_id or not target_id:
        return content, False
    
    modified = False
    
    # Pattern to match PBXSourcesBuildPhase sections
    sources_pattern = r'([A-F0-9]{24}) /\* Sources \*/ = \{[^}]*isa = PBXSourcesBuildPhase;[^}]*files = \([^)]*\);'
    
    for match in re.finditer(sources_pattern, content, re.DOTALL):
        section = match.group(0)
        
        # Check if this sources section belongs to our target
        # Look ahead to see if this is associated with the target
        remaining_content = content[match.end():]
        if target_id in remaining_content[:5000]:  # Check nearby content
            # Remove the file reference from this sources section
            file_pattern = rf'\s*([A-F0-9]{{24}}) /\* {re.escape(file_id)} in Sources \*/,?\n?'
            if re.search(file_pattern, section):
                modified_section = re.sub(file_pattern, '', section)
                content = content.replace(section, modified_section)
                modified = True
    
    return content, modified

def fix_project():
    """Main function to fix the project"""
    print("🔧 MurphysLaws UI Tests Auto-Fix")
    print("=" * 50)
    print()
    
    # Create backup
    print("📦 Creating backup...")
    backup_file = backup_project()
    print()
    
    # Read project file
    print("📖 Reading project file...")
    content = read_project_file()
    print("✅ Project file loaded")
    print()
    
    # Find UI Tests target ID
    print("🔍 Finding UI Tests target...")
    ui_tests_target_id = find_target_id(content, "MurphysLawsUITests")
    if ui_tests_target_id:
        print(f"✅ Found UI Tests target: {ui_tests_target_id}")
    else:
        print("⚠️  Could not find UI Tests target ID")
    print()
    
    # Files to remove from UI Tests target
    files_to_fix = [
        "SharedContentLoader.swift",
        "ContentPage.swift"
    ]
    
    modifications_made = False
    
    for filename in files_to_fix:
        print(f"🔍 Processing {filename}...")
        file_id = find_file_reference_id(content, filename)
        
        if file_id:
            print(f"   Found file reference: {file_id}")
            
            if ui_tests_target_id:
                content, modified = remove_file_from_target(content, file_id, ui_tests_target_id)
                if modified:
                    print(f"   ✅ Removed from UI Tests target")
                    modifications_made = True
                else:
                    print(f"   ℹ️  Not found in UI Tests target (already clean)")
            else:
                print(f"   ⚠️  Skipping (no target ID)")
        else:
            print(f"   ⚠️  File reference not found")
        print()
    
    if modifications_made:
        print("💾 Writing changes...")
        write_project_file(content)
        print("✅ Project file updated!")
        print()
        print("📋 Next steps:")
        print("1. Open Xcode")
        print("2. Clean Build Folder (Shift + Cmd + K)")
        print("3. Build (Cmd + B)")
        print()
        print(f"If you need to restore: cp {backup_file} {PROJECT_FILE}")
    else:
        print("ℹ️  No modifications needed - project appears clean")
        print()
        print("The linker errors might be due to:")
        print("1. Cached build data - try cleaning build folder")
        print("2. Derived data - try: rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*")
        print("3. Framework references - check Build Phases in Xcode")
    
    print()
    print("=" * 50)
    print("Done!")

if __name__ == "__main__":
    try:
        fix_project()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
