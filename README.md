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

- `positron-r-package-manager.showRIcon`
  _(boolean, default: false)_
  When enabled, displays a small R logo next to each package in the sidebar to visually indicate package entries.

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

- Packages installed or detached manually via console are not immediately reflected — use **Refresh** to sync.

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
