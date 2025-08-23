# Change Log

All notable changes to the "positron-r-package-manager" extension will be documented in this file.

## 0.1.3

- Added support for pak package installer as an alternative to `install.packages()`
- Added configuration option to choose between "native" (`install.packages`) and "pak" installers
- Improved local package installation to properly handle .zip files as binary packages
- Enhanced error handling with automatic fallback to native installer when pak is unavailable
- Added GitHub and local package installation support for pak installer

## 0.1.2

- Added a toggle to show only loaded packages in the sidebar- Added a toggle in the sidebar to show only loaded packages, improving package navigation

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