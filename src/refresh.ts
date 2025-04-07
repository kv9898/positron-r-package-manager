import * as vscode from 'vscode';
import * as positron from 'positron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SidebarProvider, RPackageInfo } from './sidebar';

export function refreshPackages(sidebarProvider: SidebarProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    // The code you place here will be executed every time your command is executed
    // Load Tidyverse package
    const tmpPath = path.join(os.tmpdir(), `r_packages_${Date.now()}.json`);
    const rTmpPath = tmpPath.replace(/\\/g, '/');

    // R code to write installed + loaded package info to JSON

    const rCode = `
      jsonlite::write_json(
        {
          df <- do.call(rbind, lapply(.libPaths(), function(lib) {
            if (!dir.exists(lib)) return(NULL)
      
            pkgs <- installed.packages(lib.loc = lib)[, c("Package", "Version"), drop = FALSE]
            if (nrow(pkgs) == 0) return(NULL)  # Skip empty libraries
      
            titles <- vapply(pkgs[, "Package"], function(pkg) {
              tryCatch(packageDescription(pkg, fields = "Title"), error = function(e) NA_character_)
            }, character(1))
      
            # Safely get loaded package paths
            loaded_pkgs <- loadedNamespaces()
            loaded_paths <- vapply(loaded_pkgs, function(pkg) {
              tryCatch(dirname(getNamespaceInfo(pkg, "path")), error = function(e) NA_character_)
            }, character(1), USE.NAMES = TRUE)
      
            data.frame(
              Package = pkgs[, "Package"],
              Version = pkgs[, "Version"],
              LibPath = lib,
              LocationType = if (normalizePath(lib, winslash = "/", mustWork = FALSE) %in% 
                                  normalizePath(.Library, winslash = "/", mustWork = FALSE)) "System" else "User",
              Title = titles,
              Loaded = pkgs[, "Package"] %in% names(loaded_paths) & loaded_paths[pkgs[, "Package"]] == lib,
              stringsAsFactors = FALSE
            )
          }))
      
          df[order(df$Package, df$LibPath), ]
        },
        path = "${rTmpPath}",
        auto_unbox = TRUE
      )
      `.trim();

    positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent).then(() => {
      try {
        const contents = fs.readFileSync(tmpPath, 'utf-8');
        const parsed: { Package: string; Version: string; LibPath: string; LocationType: string; Title: string; Loaded: boolean }[] = JSON.parse(contents);

        // // Count loaded packages
        // const loadedCount = parsed.filter(pkg => pkg.loaded).length;
        // const totalCount = parsed.length;

        // // Show result
        // vscode.window.showInformationMessage(`✔️ ${loadedCount} loaded out of ${totalCount} installed R packages.`);

        // Optional: clean up
        try {
          fs.unlinkSync(tmpPath);
        } catch (unlinkErr) {
          console.warn('[Positron] Failed to delete temp file:', unlinkErr);
          // No user-facing message, just dev-side warning
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
        resolve();
      } catch (err) {
        vscode.window.showErrorMessage('Failed to read or parse R output: ' + (err instanceof Error ? err.message : String(err)));
        reject(err);
      }
    }, reject);
  });
};