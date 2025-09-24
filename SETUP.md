# GitHub Actions Setup for Copilot Agent

This document explains how the GitHub Actions setup workflow resolves firewall issues in isolated environments like GitHub Copilot's coding agent.

## The Problem

When running `yarn run test` in isolated environments, you may encounter this error:

```
Failed to download VS Code: getaddrinfo ENOTFOUND update.code.visualstudio.com
```

This happens because the VS Code testing framework tries to download VS Code binaries from `https://update.code.visualstudio.com/api/releases/stable` but gets blocked by firewall restrictions.

## The Solution

The repository includes a **Setup Workflow** (`.github/workflows/setup.yml`) that runs **before** firewall restrictions are enabled and pre-downloads all necessary dependencies.

### How It Works

1. **Pre-download Phase**: The setup workflow runs when there's network access
2. **Dependency Installation**: Installs all yarn dependencies using `yarn install --frozen-lockfile`
3. **VS Code Download**: Uses `@vscode/test-electron` to download VS Code binaries to `.vscode-test/`
4. **Caching**: Caches the downloaded VS Code binaries for future use
5. **Validation**: Builds extension, compiles tests, and runs linting

### Workflow Files

- **`.github/workflows/setup.yml`**: Pre-downloads dependencies and VS Code binaries
- **`.github/workflows/test.yml`**: Uses cached dependencies to run tests without network access

### Manual Trigger

To manually trigger the setup workflow:

1. Go to the repository's Actions tab
2. Select "Setup for Copilot Agent" workflow
3. Click "Run workflow" button
4. Choose the branch and click "Run workflow"

### What Gets Downloaded

The setup workflow downloads:
- All Node.js dependencies via `yarn install --frozen-lockfile`
- VS Code stable release binaries (typically ~100-200MB)
- Extension build artifacts

### Caching Strategy

VS Code binaries are cached using:
- **Key**: `vscode-test-{OS}-{package.json hash}`
- **Path**: `.vscode-test/` directory
- **Duration**: Until package.json changes

This ensures VS Code only gets downloaded once per configuration.

### Verification

After the setup workflow completes, you should see:
- ✅ Dependencies installed
- ✅ Extension compiled
- ✅ VS Code test binaries downloaded to `.vscode-test/`
- ✅ Tests ready to run without network access

### For Developers

If you're working on this extension and encounter network issues:

1. Ensure the setup workflow has run successfully
2. Check that `.vscode-test/` directory exists and contains VS Code binaries
3. Use the test workflow to validate functionality

### Troubleshooting

**Setup workflow fails**:
- Check if `update.code.visualstudio.com` is accessible during the workflow run
- Verify `@vscode/test-electron` dependency version is compatible

**Tests still fail after setup**:
- Ensure `.vscode-test` directory contains VS Code binaries
- Check the cache was restored correctly
- Verify yarn dependencies are installed

**Cache issues**:
- The cache key includes `package.json` hash, so dependency changes invalidate the cache
- Manually clear the cache from the Actions tab if needed