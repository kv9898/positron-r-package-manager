# Positron R Package Manager Extension

This is a VS Code extension for Positron (R-focused IDE) that provides R package management functionality through a sidebar interface. The extension allows users to install, update, uninstall, and search R packages directly from the IDE.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Build
Run these commands in order to set up the development environment:

```bash
cd /path/to/positron-r-package-manager
yarn install --frozen-lockfile
yarn run compile
```

**Build Times and Timeouts:**
- `yarn install --frozen-lockfile` — Takes 15-20 seconds. NEVER CANCEL. Set timeout to 300+ seconds.
- `yarn run compile` — Takes 2-3 seconds. Set timeout to 60+ seconds.
- `yarn run package` — Takes 3-4 seconds for production build. Set timeout to 60+ seconds.
- `yarn run compile-tests` — Takes 2-3 seconds. Set timeout to 60+ seconds.
- `yarn run lint` — Takes 1-2 seconds. Set timeout to 30+ seconds.
- `vsce package` — Takes 5-6 seconds including prepublish. NEVER CANCEL. Set timeout to 120+ seconds.

### Development Workflow
- **Build the extension**: `yarn run compile` (development) or `yarn run package` (production)
- **Watch mode**: `yarn run watch` - automatically rebuilds on file changes
- **Watch tests**: `yarn run watch-tests` - automatically recompiles tests on changes
- **Run linting**: `yarn run lint` - checks code quality (expect warnings in test files)
- **Compile tests**: `yarn run compile-tests` - compiles TypeScript test files to JavaScript
- **Package extension**: `vsce package` - creates .vsix file for distribution (includes prepublish build)

### Testing
- **IMPORTANT**: `yarn run test` will fail due to network connectivity issues (tries to download VS Code). This is expected in isolated environments.
- Tests are located in `src/test/extension.test.ts`
- Use `yarn run compile-tests` to validate test compilation
- The test framework uses VS Code's extension testing infrastructure

## Validation

### Manual Validation Requirements
After making changes to the extension:

1. **ALWAYS run the full build sequence**:
   ```bash
   yarn run compile
   yarn run lint
   yarn run compile-tests
   ```

2. **Test the extension in VS Code**:
   - Press F5 to launch Extension Development Host
   - Verify the R Package Manager sidebar appears (📖 book icon)
   - Test basic functionality like refresh, search, and install dialogs
   
3. **Production build validation**:
   ```bash
   yarn run package
   vsce package
   ```
   - Verify `dist/extension.js` is created and minified (~33KB)
   - Verify `.vsix` file is created (~140KB)
   - Check that file size is reasonable for distribution

4. **Before committing**: ALWAYS run `yarn run lint` and fix any errors (warnings in test files are acceptable)

## Repository Structure

### Key Files and Directories
```
/
├── src/                    # TypeScript source code
│   ├── extension.ts        # Main extension entry point
│   ├── sidebar.ts          # R package sidebar provider
│   ├── install.ts          # Package installation logic
│   ├── update-uninstall.ts # Update and uninstall functionality
│   ├── refresh.ts          # Package list refresh logic
│   ├── utils.ts            # Utility functions and R execution
│   ├── events.ts           # Positron runtime event handling
│   └── test/               # Test files
├── dist/                   # Compiled extension output
├── out/                    # Compiled test output
├── positron-dts/           # Positron API type definitions
├── package.json            # Extension manifest and dependencies
├── webpack.config.js       # Build configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # Linting configuration
├── .vscode/                # VS Code workspace settings
└── .github/workflows/      # CI/CD pipeline
```

### Core Components
- **extension.ts**: Main activation function, command registration
- **sidebar.ts**: Tree view provider for R packages list
- **install.ts**: Package installation from CRAN, GitHub, and local files
- **refresh.ts**: Fetches package information from R runtime
- **utils.ts**: R code execution helpers and error handling
- **positron-dts/**: Type definitions for Positron-specific APIs

## Common Tasks

### Adding New Commands
1. Add command to `package.json` in `contributes.commands`
2. Register command in `extension.ts` activate function
3. Implement command logic in appropriate module
4. Add to menus in `package.json` if needed

### Working with R Runtime
- Use `positron.runtime.executeCode()` for R code execution
- Always use `positron.RuntimeCodeExecutionMode.Silent` for background operations
- Use `getObserver()` from utils.ts for error handling
- R code should avoid polluting global environment

### Localization
- Strings are localized using `vscode.l10n.t()`
- English strings in `package.nls.json`
- Chinese translations in `package.nls.zh-cn.json`
- Add new strings to both files

### Package Scripts Reference
```json
{
  "compile": "webpack",                          // Development build
  "watch": "webpack --watch",                   // Watch mode
  "package": "webpack --mode production",       // Production build
  "compile-tests": "tsc -p . --outDir out",    // Compile tests
  "watch-tests": "tsc -p . -w --outDir out",   // Watch tests
  "lint": "eslint src",                         // Code linting
  "test": "vscode-test",                        // Run tests (fails offline)
  "vscode:prepublish": "yarn run package"      // Pre-publish hook (auto-run by vsce)
}
```

### Extension Packaging
- **Package for distribution**: `vsce package` - creates `.vsix` file
- Automatically runs `yarn run package` via `vscode:prepublish` hook
- Final package includes all necessary files (~140KB total)
- Use `--no-yarn` flag if needed: `vsce package --no-yarn`

## Configuration and Dependencies

### CI/CD Pipeline
The repository uses GitHub Actions for automated publishing:
- **Workflow file**: `.github/workflows/publish.yml`
- **Triggers**: Manual dispatch or version tags
- **Process**: Install deps → Build → Package → Publish to Open VSX → Create GitHub Release
- **Build command in CI**: `yarn run package` (production build)
- **Package command in CI**: `npx vsce package`

### Runtime Requirements
- Positron version 2025.02.0-79 or later
- VS Code extension host environment
- Node.js runtime for build tools
- R runtime integration through Positron APIs

### Build Dependencies
- **TypeScript**: Language and compiler
- **Webpack**: Module bundler and build system
- **ESLint**: Code quality and style checking
- **VS Code Extension API**: Core extension functionality
- **Positron API**: R runtime integration

### Key Dependencies
- `fuzzaldrin-plus`: Fuzzy search functionality for package filtering
- `@types/vscode`: VS Code API type definitions
- Custom `positron` types from `positron-dts/`

## Development Best Practices

### VS Code Development Setup
The repository includes VS Code workspace configuration:
- **Recommended extensions**: ESLint, TSL Problem Matcher, Extension Test Runner
- **Launch configuration**: Press F5 to start Extension Development Host
- **Watch tasks**: Use `Tasks: Run Task` → `npm: watch` for auto-compilation
- **Settings**: Excludes `out/` and `dist/` from search but shows in explorer

### Code Style
- Follow ESLint configuration in `eslint.config.mjs`
- Use TypeScript strict mode
- Prefer async/await over callbacks
- Handle errors gracefully with user-friendly messages

### R Integration
- Use `getObserver()` for R execution error handling
- Check for active R sessions before operations
- Use temporary files in system temp directory for R data exchange
- Clean up temporary files after use

### Extension Lifecycle
- Register all commands and providers in `activate()`
- Use `context.subscriptions.push()` for proper cleanup
- Handle extension deactivation gracefully

### Common Patterns
- Check for R runtime availability before operations
- Show progress indicators for long-running operations
- Refresh package list after install/uninstall operations
- Use VS Code's built-in UI components (QuickPick, InputBox)

## Troubleshooting

### Build Issues
- **"Cannot resolve module 'positron'"**: Check webpack alias in `webpack.config.js`
- **TypeScript errors**: Verify `tsconfig.json` paths configuration
- **Missing dependencies**: Run `yarn install --frozen-lockfile`

### Runtime Issues
- **"No active R console session"**: User needs to start R in Positron
- **Package installation failures**: Check R library path permissions
- **Missing jsonlite**: Extension will prompt user to install

### Development Issues
- **Extension not loading**: Check `dist/extension.js` exists after build
- **Changes not reflected**: Use F5 to reload Extension Development Host
- **Debugging**: Use VS Code debugger with launch configuration in `.vscode/launch.json`