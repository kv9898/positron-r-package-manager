# 📦 Positron R Package Manager

Manage your R extensions from within [Positron](https://positron.posit.co/) — the RStudio-style package manager for the modern data science IDE.

<img src="https://github.com/user-attachments/assets/5fef4eb8-50b8-4ad1-bdf0-60a1e8c131dd" alt="Positron R Package Sidebar" width="300"/>

---

# 📚 How to Find the Sidebar

Once the extension is installed and activated, you can find the R Package Manager sidebar by looking for the 📖 icon of an opened book in the primary sidebar on the left side of the VS Code window.

This icon represents the R packages view provided by this extension.

## 🧭 Recommended: Move it to the Right (Just like RStudio)

To better match the layout you're familiar with in RStudio, you can _drag_ the entire R Package Manager sidebar to the secondary sidebar on the right.

Alternatively,

1. Right-click the opened book icon (📖) or the sidebar tab.

2. Choose "Move to" then "Secondary Side bar" from the context menu.

3. The sidebar will now appear on the right, just like the RStudio "Packages" pane.

You can always move it back or rearrange it as you prefer.

---

## 🚀 Features

- ✅ View all **installed R packages** in a tidy sidebar
- ✅ Check which packages are **loaded** (like RStudio's "Packages" tab)
- ✅ **Install** one or multiple packages from CRAN (space/comma-separated)
- ✅ **Install** individual packages from GitHub or a local archive
- ✅ **Update** outdated packages with version preview and multi-select
- ✅ **Uninstall** packages with a single click
- ✅ 🔍 **Search** by name or title (fuzzy search supported)
- ✅ Toggle to show **loaded** packages only
- ✅ Checkbox toggling to load/unload

---

## 🛠 Requirements

- Positron version `2025.02.0-79` or later
- [`jsonlite`](https://cran.r-project.org/package=jsonlite) must be installed in the R runtime (used for data exchange).
- R installed and working inside Positron
- This extension must run in the **workspace** (remote/WSL/container supported ✅)

---

## 🌐 Language Support

This extension currently supports the following languages:

- 🇺🇸 **English**
- 🇨🇳 **简体中文 (Simplified Chinese)**

The UI will automatically display in your Positron language setting.

If you'd like to contribute translations or suggest improvements, feel free to open an issue or pull request!

---

## ⚙️ Extension Settings

This extension provides the following setting:

- `positron-r-package-manager.filterOutdatedIfUpToDateElsewhere`  
  _(boolean, default: `true`)_  
  When enabled, filters out outdated R packages if an up-to-date version exists in another library during updates. This helps ruling out package installations that are not updatable in their current locations.

- `positron-r-package-manager.showIcons`
  _(boolean, default: false)_
  When enabled, displays a small R logo and a package type icon next to each package in the sidebar to visually indicate package entries.

- `positron-r-package-manager.defaultInstaller`
  _(string, default: `"native"`)_
  Choose which package installer to use:
  - `"native"`: Use R's built-in `install.packages()` function
  - `"pak"`: Use the `pak::pkg_install()` function (requires the pak package to be installed)

You can configure this setting in your VS Code settings (`settings.json`) or through the Settings UI.

---

## 📂 Commands

You can access these from the sidebar or Command Palette:

| Command                            | Description                                        |
| ---------------------------------- | -------------------------------------------------- |
| `R: Install Packages`              | Install one or more packages                       |
| `R: Update Installed Packages`     | Update selected outdated packages                  |
| `R: Uninstall Package`             | Uninstall a selected package                       |
| `R: Refresh package information`   | Reload the package list from the current R session |
| `R: Search for installed packages` | Filter package list by name/title                  |

---

## ⚠️ Known Issues

- Packages installed manually via console are not immediately reflected — use **Refresh** to sync.

---

## 🔧 Development & CI/CD

### For Copilot Agent Development

This repository includes GitHub Actions workflows specifically designed to work with GitHub Copilot's coding agent:

- **Setup Workflow** (`.github/workflows/setup.yml`): Runs before firewall restrictions are enabled to pre-download all necessary dependencies including VS Code test binaries
- **Test Workflow** (`.github/workflows/test.yml`): Uses cached dependencies to run tests without external network access

The setup workflow resolves the common issue where `yarn run test` fails with `ENOTFOUND update.code.visualstudio.com` by pre-downloading VS Code binaries using `@vscode/test-electron`.

### Local Development

```bash
# Install dependencies
yarn install --frozen-lockfile

# Build extension (development mode)
yarn run compile

# Build extension (production mode)  
yarn run package

# Run linting
yarn run lint

# Compile tests
yarn run compile-tests

# Run tests (requires network access to download VS Code)
yarn run test
```

### GitHub Actions Setup

The repository includes automated workflows for:
- **Publishing**: Builds and publishes to Open VSX registry and GitHub releases
- **Setup**: Pre-downloads dependencies for isolated environments
- **Testing**: Validates functionality using cached dependencies

---

## 🙏 Attribution

Created by [kv9898](https://github.com/kv9898)  
Licensed under the [MIT License](./LICENSE)

<!-- ---

## 💡 Future Ideas

- [ ] sth -->

---

## 🧠 Why Positron?

Because it’s time for a modern, polyglot, VS Code-based Data Science IDE — and this extension brings one of RStudio's most beloved panels to the future.
