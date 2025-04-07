# 📦 Positron R Package Manager

Manage your R extensions from within [Positron](https://positron.posit.co/) — the RStudio-style package manager for the modern data science IDE.

<img src="https://github.com/user-attachments/assets/5fef4eb8-50b8-4ad1-bdf0-60a1e8c131dd" alt="Positron R Package Sidebar" width="300"/>

---

## 🚀 Features

- ✅ View all **installed R packages** in a tidy sidebar
- ✅ Check which packages are **loaded** (like RStudio's "Packages" tab)
- ✅ **Install** one or multiple packages (space/comma-separated)
- ✅ **Update** outdated packages with version preview and multi-select
- ✅ **Uninstall** packages with a single click
- ✅ 🔍 **Search** by name or title (fuzzy search supported)
- ✅ Checkbox toggling to load/unload

---

## 🛠 Requirements

- Positron version `2025.02.0-79` or later
- [`jsonlite`](https://cran.r-project.org/package=jsonlite) must be installed in the R runtime (used for data exchange).
- R installed and working inside Positron
- This extension must run in the **workspace** (remote/WSL/container supported ✅)

---

## ⚙️ Extension Settings

This extension currently has no user-facing settings — it's fully automatic.

---

## 📂 Commands

You can access these from the sidebar or Command Palette:

| Command | Description |
|--------|-------------|
| `R: Install Packages` | Install one or more packages by name |
| `R: Update Installed Packages` | Update selected outdated packages |
| `R: Uninstall Package` | Uninstall a selected package |
| `R: Refresh package information` | Reload the package list from the current R session |
| `R: Search for installed packages` | Filter package list by name/title |

---

## ⚠️ Known Issues

- Packages installed or detached manually via console are not immediately reflected — use **Refresh** to sync.
- The extension currently uses `install.packages()` which installs to the default library path.

---

## 🙏 Attribution

Created by [kv9898](https://github.com/kv9898)  
Licensed under the [MIT License](./LICENSE)

---

## 💡 Future Ideas

- [ ] Install from GitHub or Bioconductor
- [ ] Chinese language support

---

## 🧠 Why Positron?

Because it’s time for a modern, polyglot, VS Code-based Data Science IDE — and this extension brings one of RStudio's most beloved panels to the future.
