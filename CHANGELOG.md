# Change Log

All notable changes to the "positron-r-package-manager" extension will be documented in this file

## 0.2.4

- Added clickable NEWS button to package update selection dialog (opens the package's NEWS page on CRAN)

## 0.2.3

- Added renv and dev as a library location (@ntluong95)
- Enhanced tooltip display (@ntluong95)
- Imperfectly align package information in the sidebar for better readability

## 0.2.2

- Removed the package-list refresh delay. It was a workaround for a Positron bug that displayed queued silent code, fixed in [#9772](https://github.com/posit-dev/positron/pull/9772)

## 0.2.1

- Fixed an issue where the loaded packages would not display correctly when renv is used on Linux/MacOS

## 0.2.0

- Extension now automatically refreshes the package list when R code loads or unloads a package (library(), require(), pacman::p_load(), detach())

## 0.1.6

- Fixed compilation prompt appearing multiple times during package updates with native installer
- Package updates now group packages by library path to reduce installation prompts

## 0.1.5

- Add checks for library path writability before attempting package installations or updates,
  to prevent errors when using non-writable directories.

## 0.1.4

- Stopped `pak` from asking to install packages that are already installed
- Parallelised package updates with `pak` for faster execution

## 0.1.3

- Added support for pak package installer as an alternative to `install.packages()`
- Added configuration option to choose between "native" (`install.packages`) and "pak" installers
- Improved local package installation to properly handle .zip files as binary packages
- Enhanced error handling with automatic fallback to native installer when pak is unavailable
- Added GitHub and local package installation support for pak installer

## 0.1.2

- Added a toggle to show only loaded packages in the sidebar- Added a toggle in the sidebar to show only loaded packages, improving package navigation (@mburtin)

## 0.1.1

- Switched from detecting R runtimes to detecting active console sessions for refreshes

## 0.1.0

- Added progress indicator to R package update check

## 0.0.9

- Added an optional R logo next to package names to enhance visual clarity
- Improved documentation on how to locate and use the R Package Manager sidebar

## 0.0.8

- Fixed ENOENT errors errors during Positron load
- Improved refresh logic for a more robust and streamlined experience

## 0.0.7

- Made all R-side operations stealth-safe to prevent polluting the global environment
- Added support for installing packages from GitHub and local archives
- Added option to install packages to a custom library path

## 0.0.6

- Added prompt to install the `jsonlite` package
- Added automatic refresh when a new R session starts or the R console is switched

## 0.0.5

- Added localisation support for Chinese
- Updated extension keywords

## 0.0.4

- Added fuzzy search support for installed R packages
- Updated sidebar title: "Packages: Installed" → "Packages: R"

## 0.0.3

- Handled multiple installations of the same package across library paths

## 0.0.2

- Lowered minimum required Positron version to `2025.02.0-79` for broader compatibility

## 0.0.1

- Initial release
