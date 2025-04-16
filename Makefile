# Project configuration
DOCKER_REPO := hyperdrive
RUNTIME_DIR := apps/runtime
UI_DIR := apps/ui
WEBSITE_DIR := apps/website

# Tool configuration
PNPM := pnpm
GO := go
PRETTIER := $(PNPM) prettier
TSC := $(PNPM) tsc
ESLINT := $(PNPM) eslint

# Build configuration
GO_BUILD_FLAGS := -v
GO_BUILD_OUTPUT := $(RUNTIME_DIR)/dist/hyperdrive

# Docker configuration
DOCKER_BUILD_ARGS := --build-arg NODE_ENV=production

# Include component-specific makefiles
-include .makefiles/*.mk

################################################################################
# Main targets
################################################################################

.PHONY: all
all: build ## Build everything

.PHONY: build
build: build-ui build-go ## Build all components
	@echo "Building all components..."

.PHONY: build-ui
build-ui: node_modules ## Build UI
	@echo "Building UI..."
	@cd $(UI_DIR) && $(NEXT) build

.PHONY: build-go
build-go: go.sum ## Build Go runtime
	@echo "Building Go runtime..."
	@mkdir -p $(RUNTIME_DIR)/dist
	@cd $(RUNTIME_DIR) && $(GO) build $(GO_BUILD_FLAGS) -o dist/hyperdrive ./cmd/hyperdrive

.PHONY: dev-ui
dev-ui: node_modules ## Start UI in development mode
	@echo "Starting UI in development mode..."
	@cd $(UI_DIR) && $(PNPM) run dev

.PHONY: dev-go
dev-go: go.sum ## Start Go runtime in development mode
	@echo "Starting Go runtime in development mode..."
	@cd $(RUNTIME_DIR) && $(GO) run ./cmd/hyperdrive

.PHONY: test
test: test-ui test-go ## Run all tests
	@echo "Running all tests..."

.PHONY: test-ui
test-ui: node_modules ## Run UI tests
	@echo "Running UI tests..."
	@cd $(UI_DIR) && $(PNPM) vitest run

.PHONY: test-go
test-go: go.sum ## Run Go tests
	@echo "Running Go tests..."
	@cd $(RUNTIME_DIR) && $(GO) test ./...

.PHONY: lint
lint: lint-ui lint-go ## Run all linters
	@echo "Running all linters..."

.PHONY: lint-ui
lint-ui: node_modules ## Run UI linters
	@echo "Running UI linters..."
	@cd $(UI_DIR) && $(ESLINT) .

.PHONY: lint-go
lint-go: go.sum ## Run Go linters
	@echo "Running Go linters..."
	@cd $(RUNTIME_DIR) && $(GO) vet ./...

.PHONY: format
format: format-ui format-go ## Format all code
	@echo "Formatting all code..."

.PHONY: format-ui
format-ui: node_modules ## Format UI code
	@echo "Formatting UI code..."
	@$(PRETTIER) --write "**/*.{ts,tsx,md,json}"

.PHONY: format-go
format-go: go.sum ## Format Go code
	@echo "Formatting Go code..."
	@cd $(RUNTIME_DIR) && $(GO) fmt ./...

.PHONY: typecheck
typecheck: node_modules ## Run TypeScript type checking
	@echo "Running type checking..."
	@cd $(UI_DIR) && $(TSC) --noEmit

.PHONY: clean
clean: clean-ui clean-go clean-docker ## Clean all build artifacts
	@echo "Cleaning all build artifacts..."
	@rm -rf artifacts/

.PHONY: clean-ui
clean-ui: ## Clean UI build artifacts
	@echo "Cleaning UI build artifacts..."
	@cd $(UI_DIR) && rm -rf .next out dist node_modules

.PHONY: clean-go
clean-go: ## Clean Go build artifacts
	@echo "Cleaning Go build artifacts..."
	@cd $(RUNTIME_DIR) && rm -rf dist

################################################################################
# Dependencies
################################################################################

node_modules: package.json $(UI_DIR)/package.json
	@echo "Installing Node.js dependencies..."
	@$(PNPM) install
	@touch node_modules

go.sum: $(RUNTIME_DIR)/go.mod
	@echo "Downloading Go dependencies..."
	@cd $(RUNTIME_DIR) && $(GO) mod download
	@touch go.sum

################################################################################
# Helper targets
################################################################################

.PHONY: help
help: ## Show this help
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
