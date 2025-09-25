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
              tryCatch(dirname(getNamespaceInfo(pkg, "path")), error = function(e) NA_character_)
            }, character(1), USE.NAMES = TRUE)

            # Create a more robust loading check that handles renv and symlinks
            loaded_status <- vapply(pkgs[, "Package"], function(pkg_name) {
              if (!pkg_name %in% names(loaded_paths)) return(FALSE)
              
              loaded_path <- loaded_paths[pkg_name]
              if (is.na(loaded_path)) return(FALSE)
              
              # Normalize both paths for comparison
              norm_loaded <- normalizePath(loaded_path, winslash = "/", mustWork = FALSE)
              norm_lib <- normalizePath(lib, winslash = "/", mustWork = FALSE)
              
              # Direct path match (works for most standard cases)
              if (norm_loaded == norm_lib) return(TRUE)
              
              # Check if the loaded path is a subdirectory of the library path
              # This handles cases where packages are in nested structures
              if (startsWith(norm_loaded, paste0(norm_lib, "/")) || startsWith(norm_loaded, paste0(norm_lib, "\\"))) return(TRUE)
              
              # Check if the library path is a subdirectory of the loaded path
              # This handles cases where library points to a subdirectory of where package is actually loaded
              if (startsWith(norm_lib, paste0(norm_loaded, "/")) || startsWith(norm_lib, paste0(norm_loaded, "\\"))) return(TRUE)
              
              # Special handling for renv environments
              if (grepl("renv", norm_loaded, fixed = TRUE) && grepl("renv", norm_lib, fixed = TRUE)) {
                # Both paths contain renv, let's do a more sophisticated comparison
                
                # Split paths and find common segments
                loaded_parts <- strsplit(norm_loaded, "[/\\\\]")[[1]]
                lib_parts <- strsplit(norm_lib, "[/\\\\]")[[1]]
                
                # Find renv positions in both paths
                renv_pos_loaded <- which(loaded_parts == "renv")
                renv_pos_lib <- which(lib_parts == "renv")
                
                if (length(renv_pos_loaded) > 0 && length(renv_pos_lib) > 0) {
                  # Compare the project paths (parts before renv)
                  project_loaded <- paste(loaded_parts[1:(renv_pos_loaded[1]-1)], collapse = "/")
                  project_lib <- paste(lib_parts[1:(renv_pos_lib[1]-1)], collapse = "/")
                  
                  # If they are from the same renv project, the package is likely loaded from this library
                  if (project_loaded == project_lib) return(TRUE)
                }
                
                # Fallback: if both are renv paths and contain the package name, consider it loaded
                if (grepl(pkg_name, norm_loaded, fixed = TRUE)) return(TRUE)
              }
              
              # Additional check for complex symlink scenarios
              # Use realpath-like logic by checking if the paths resolve to the same location
              tryCatch({
                # This is a more expensive check, so we do it last
                real_loaded <- Sys.readlink(loaded_path)
                real_lib <- Sys.readlink(lib)
                
                if (!is.na(real_loaded) && !is.na(real_lib)) {
                  if (normalizePath(dirname(real_loaded), winslash = "/", mustWork = FALSE) == 
                      normalizePath(real_lib, winslash = "/", mustWork = FALSE)) {
                    return(TRUE)
                  }
                }
              }, error = function(e) {
                # Ignore errors from readlink - not all systems support it
              })
              
              # If none of the above match, the package is likely loaded from a different library
              return(FALSE)
            }, logical(1))

            df <- data.frame(
              Package = pkgs[, "Package"],
              Version = pkgs[, "Version"],
              LibPath = lib,
              LocationType = if (normalizePath(lib, winslash = "/", mustWork = FALSE) %in%
                                   normalizePath(.Library, winslash = "/", mustWork = FALSE)) "System" else "User",
              Title = titles,
              Loaded = loaded_status,
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