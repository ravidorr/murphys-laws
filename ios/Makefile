.PHONY: help setup open test clean

help: ## Show this help message
	@echo "Murphy's Laws iOS - Available Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

setup: ## Generate Xcode project using XcodeGen
	@./generate-xcode-project.sh

open: ## Open the Xcode project
	@if [ -d "MurphysLaws.xcodeproj" ]; then \
		open MurphysLaws.xcodeproj; \
	else \
		echo "❌ Xcode project not found. Run 'make setup' first."; \
		exit 1; \
	fi

test: ## Run unit tests
	@if [ -d "MurphysLaws.xcodeproj" ]; then \
		xcodebuild test \
			-project MurphysLaws.xcodeproj \
			-scheme MurphysLaws \
			-destination 'platform=iOS Simulator,name=iPhone 15'; \
	else \
		echo "❌ Xcode project not found. Run 'make setup' first."; \
		exit 1; \
	fi

build: ## Build the app
	@if [ -d "MurphysLaws.xcodeproj" ]; then \
		xcodebuild build \
			-project MurphysLaws.xcodeproj \
			-scheme MurphysLaws \
			-destination 'platform=iOS Simulator,name=iPhone 15'; \
	else \
		echo "❌ Xcode project not found. Run 'make setup' first."; \
		exit 1; \
	fi

clean: ## Clean build artifacts
	@if [ -d "MurphysLaws.xcodeproj" ]; then \
		xcodebuild clean \
			-project MurphysLaws.xcodeproj \
			-scheme MurphysLaws; \
	fi
	@rm -rf build/
	@rm -rf DerivedData/
	@echo "✅ Cleaned build artifacts"

regenerate: ## Regenerate Xcode project (useful after adding/removing files)
	@./generate-xcode-project.sh
