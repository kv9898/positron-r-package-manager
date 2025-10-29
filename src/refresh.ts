import * as vscode from 'vscode';
import * as positron from 'positron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SidebarProvider, RPackageInfo } from './sidebar';
import { getObserver, waitForFile } from './utils';


/**
 * Refreshes the package list displayed in the sidebar by executing R code to retrieve
 * information about installed and loaded R packages. The package information is then
 * passed to the SidebarProvider to update the tree view.
 *
 * This function generates a temporary JSON file containing the package information,
 * including package name, version, library path, location type, and whether it is loaded.
 * It then reads and parses this JSON file, constructs RPackageInfo objects, and uses them
 * to refresh the sidebar.
 *
 * @param sidebarProvider - The SidebarProvider instance responsible for managing the
 *                          R package tree view.
 * @returns A promise that resolves when the package list has been successfully refreshed,
 *          or rejects if there is an error in executing the R code or parsing its output.
 */

export async function refreshPackages(sidebarProvider: SidebarProvider): Promise<void> {
  // Check if an R runtime is registered, only proceed if it is
  const hasR = await positron.runtime.getRegisteredRuntimes().then((runtimes) => runtimes.some((runtime) => runtime.languageId === 'r'));
  if (!hasR) {
    throw new Error(vscode.l10n.t("No R runtime available."));
  }

  // vscode.window.showInformationMessage("Proper refresh starts"); // For Debugging

  // Execute R code to dump package information
  const tmpPath = path.join(os.tmpdir(), `r_packages_${Date.now()}.json`);
  const rTmpPath = tmpPath.replace(/\\/g, '/');

  const rCode = `
    (function() {
      jsonlite::write_json(
        {
          do.call(rbind, lapply(.libPaths(), function(lib) {
            if (!dir.exists(lib)) return(NULL)

            pkgs <- installed.packages(lib.loc = lib)[, c("Package", "Version"), drop = FALSE]
            if (nrow(pkgs) == 0) return(NULL)

            titles <- vapply(pkgs[, "Package"], function(pkg) {
              tryCatch(packageDescription(pkg, fields = "Title"), error = function(e) NA_character_)
            }, character(1))

            loaded_paths <- vapply(loadedNamespaces(), function(pkg) {
              tryCatch(getNamespaceInfo(pkg, "path"), error = function(e) NA_character_)
            }, character(1), USE.NAMES = TRUE)

            # Normalize paths for comparison to handle renv caches and symlinks
            normalized_lib <- normalizePath(lib, winslash = "/", mustWork = FALSE)
            normalized_loaded_paths <- vapply(loaded_paths, function(p) {
              if (is.na(p)) return(NA_character_)
              normalizePath(p, winslash = "/", mustWork = FALSE)
            }, character(1))

            # Expected package paths within this library (may resolve to cache via symlinks)
            expected_pkg_paths <- vapply(pkgs[, "Package"], function(p) {
              normalizePath(file.path(lib, p), winslash = "/", mustWork = FALSE)
            }, character(1), USE.NAMES = TRUE)

            df <- data.frame(
              Package = pkgs[, "Package"],
              Version = pkgs[, "Version"],
              LibPath = lib,
              LocationType = {
                # Check if library path is in an renv project (library, sandbox, or cache)
                if (grepl("/renv/", normalized_lib, fixed = TRUE) || grepl("\\\\renv\\\\", normalized_lib, fixed = TRUE)) {
                  "renv"
                } else if (normalized_lib %in% normalizePath(.Library, winslash = "/", mustWork = FALSE)) {
                  "System"
                } else {
                  "User"
                }
              },
              Title = titles,
              Loaded = {
                pkg_names <- pkgs[, "Package"]
                cmp <- normalized_loaded_paths[pkg_names] == expected_pkg_paths[pkg_names]
                !is.na(cmp) & cmp
              },
              stringsAsFactors = FALSE
            )

            df
          })) -> result

          if (is.null(result)) list() else result[order(result$Package, result$LibPath), ]
        },
        path = "${rTmpPath}",
        auto_unbox = TRUE
      )
    })()
  `.trim();

  const observer = getObserver("Error refreshing packages: {0}");

  try {
    await positron.runtime.executeCode(
      'r',
      rCode,
      false,
      undefined,
      positron.RuntimeCodeExecutionMode.Silent,
      undefined,
      observer
    );

    await waitForFile(tmpPath);

    const contents = fs.readFileSync(tmpPath, 'utf-8');
    const parsed: {
      Package: string;
      Version: string;
      LibPath: string;
      LocationType: string;
      Title: string;
      Loaded: boolean;
    }[] = JSON.parse(contents);

    try {
      fs.unlinkSync(tmpPath);
    } catch (unlinkErr) {
      console.warn(vscode.l10n.t('[Positron] Failed to delete temp file: '), unlinkErr);
    }

    const pkgInfo: RPackageInfo[] = parsed.map(pkg => ({
      name: pkg.Package,
      version: pkg.Version,
      libpath: pkg.LibPath,
      locationtype: pkg.LocationType,
      title: pkg.Title,
      loaded: pkg.Loaded
    }));

    sidebarProvider.refresh(pkgInfo);
  } catch (err) {
    vscode.window.showErrorMessage(
      vscode.l10n.t('Failed to refresh R packages: {0}', err instanceof Error ? err.message : String(err))
    );
    throw err;
  }
}