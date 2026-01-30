#!/usr/bin/env python3
"""
Remove MarkdownContentTests.swift from UI Tests target
This file uses @testable import which is not allowed in UI Tests
"""

import re
import sys

pbxproj_path = "/home/user/murphys-laws/ios/MurphysLaws.xcodeproj/project.pbxproj"

print("🔧 Removing MarkdownContentTests.swift from UI Tests target...")

# Read the project file
with open(pbxproj_path, 'r') as f:
    content = f.read()

# Remove the build file line from PBXBuildFile section
# Line: 29F7F7B62EC887D3003CC948 /* MarkdownContentTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 29F7F7B52EC887D3003CC948 /* MarkdownContentTests.swift */; };
content = re.sub(
    r'\t\t29F7F7B62EC887D3003CC948 /\* MarkdownContentTests\.swift in Sources \*/ = \{isa = PBXBuildFile; fileRef = 29F7F7B52EC887D3003CC948 /\* MarkdownContentTests\.swift \*/; \};\n',
    '',
    content
)

# Remove from UI Tests Sources build phase
# Line: 29F7F7B62EC887D3003CC948 /* MarkdownContentTests.swift in Sources */,
content = re.sub(
    r'\t\t\t\t29F7F7B62EC887D3003CC948 /\* MarkdownContentTests\.swift in Sources \*/,\n',
    '',
    content
)

# Write back
with open(pbxproj_path, 'w') as f:
    f.write(content)

print("✅ Removed MarkdownContentTests.swift from UI Tests target")
print("")
print("📋 What was changed:")
print("  - Removed from PBXBuildFile section")
print("  - Removed from UI Tests Sources build phase")
print("")
print("ℹ️  The file still exists on disk but won't be compiled with UI Tests")
print("ℹ️  If you need these tests, move the file to MurphysLawsTests/ directory")
print("")
print("UI Tests should now build successfully!")
