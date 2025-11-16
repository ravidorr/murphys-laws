#!/usr/bin/env ruby

# AGGRESSIVE FIX - Directly modifies Xcode project file
# This removes SharedContentLoader.swift and ContentPage.swift from UI Tests target

require 'fileutils'
require 'time'

PROJECT_DIR = "/Users/ravidor/personal-dev/murphys-laws/ios"
PROJECT_FILE = File.join(PROJECT_DIR, "MurphysLaws.xcodeproj", "project.pbxproj")

def backup_project
  timestamp = Time.now.strftime("%Y%m%d_%H%M%S")
  backup_file = "#{PROJECT_FILE}.backup.#{timestamp}"
  FileUtils.cp(PROJECT_FILE, backup_file)
  puts "✅ Backup created: #{backup_file}"
  backup_file
end

def read_project
  unless File.exist?(PROJECT_FILE)
    puts "❌ Error: Cannot find #{PROJECT_FILE}"
    exit 1
  end
  File.read(PROJECT_FILE)
end

def write_project(content)
  File.write(PROJECT_FILE, content)
end

def find_file_refs(content, filename)
  # Find file reference IDs for the given filename
  refs = []
  content.scan(/([A-F0-9]{24}) \/\* #{Regexp.escape(filename)} \*\//) do |match|
    refs << match[0]
  end
  refs
end

def find_ui_tests_target_id(content)
  # Find the MurphysLawsUITests target ID
  if content =~ /([A-F0-9]{24}) \/\* MurphysLawsUITests \*\/ = \{.*?isa = PBXNativeTarget;/m
    return $1
  end
  nil
end

def remove_from_build_phase(content, file_refs)
  modified = false
  
  file_refs.each do |ref|
    # Remove from PBXBuildFile sections
    # Pattern: XXXX /* filename in Sources */ = {isa = PBXBuildFile; fileRef = YYYY; };
    pattern = /\s*[A-F0-9]{24} \/\* [^*]+ in Sources \*\/ = \{\s*isa = PBXBuildFile;\s*fileRef = #{Regexp.escape(ref)}[^}]*\};\s*\n?/m
    if content.gsub!(pattern, '')
      modified = true
      puts "   ✅ Removed build file reference: #{ref}"
    end
    
    # Also remove from files array in PBXSourcesBuildPhase
    pattern2 = /\s*[A-F0-9]{24} \/\* [^*]+ in Sources \*\/,?\s*\n?/
    content.scan(/([A-F0-9]{24}) \/\* Sources \*\/ = \{[^}]*files = \([^)]*#{Regexp.escape(ref)}[^)]*\)[^}]*\}/m) do
      section_start = $~.begin(0)
      section = $~[0]
      
      # Remove reference from this sources section
      if section.gsub!(pattern2) { |match| match =~ /#{Regexp.escape(ref)}/ ? '' : match }
        content[section_start, section.length] = section
        modified = true
      end
    end
  end
  
  [content, modified]
end

def main
  puts "🔧 AGGRESSIVE FIX - Xcode Project File Editor"
  puts "=" * 60
  puts ""
  
  # Backup
  puts "📦 Creating backup..."
  backup_file = backup_project
  puts ""
  
  # Read project
  puts "📖 Reading project file..."
  content = read_project
  original_content = content.dup
  puts "✅ Project file loaded (#{content.length} bytes)"
  puts ""
  
  # Find target
  puts "🔍 Finding MurphysLawsUITests target..."
  ui_tests_target = find_ui_tests_target_id(content)
  if ui_tests_target
    puts "✅ Found target ID: #{ui_tests_target}"
  else
    puts "⚠️  Could not find UI Tests target ID"
  end
  puts ""
  
  # Process files
  files_to_fix = [
    "SharedContentLoader.swift",
    "ContentPage.swift"
  ]
  
  total_modifications = 0
  
  files_to_fix.each do |filename|
    puts "🔧 Processing #{filename}..."
    
    refs = find_file_refs(content, filename)
    if refs.empty?
      puts "   ⚠️  No references found"
      next
    end
    
    puts "   Found #{refs.length} reference(s): #{refs.join(', ')}"
    
    content, modified = remove_from_build_phase(content, refs)
    
    if modified
      total_modifications += 1
      puts "   ✅ Removed from build phases"
    else
      puts "   ℹ️  No build phase references found"
    end
    
    puts ""
  end
  
  # Write if modified
  if content != original_content
    puts "💾 Writing changes to project file..."
    write_project(content)
    puts "✅ Project file updated!"
    puts ""
    puts "📊 Summary:"
    puts "   • Files processed: #{files_to_fix.length}"
    puts "   • Modifications made: #{total_modifications}"
    puts "   • Backup location: #{backup_file}"
    puts ""
    puts "🎯 Next steps:"
    puts "   1. Open Xcode"
    puts "   2. Clean Build Folder (Shift + Cmd + K)"
    puts "   3. Build (Cmd + B)"
    puts ""
    puts "To restore backup if needed:"
    puts "   cp '#{backup_file}' '#{PROJECT_FILE}'"
  else
    puts "ℹ️  No modifications needed - project appears correct"
    puts ""
    puts "The linker errors might be caused by:"
    puts "   1. Stale derived data"
    puts "   2. Cached build artifacts"
    puts "   3. Framework linking issues"
    puts ""
    puts "Try this:"
    puts "   rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*"
    puts "   # Then clean and build in Xcode"
  end
  
  puts ""
  puts "=" * 60
end

begin
  main
rescue => e
  puts "❌ Error: #{e.message}"
  puts e.backtrace
  exit 1
end
