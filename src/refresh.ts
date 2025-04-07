import * as vscode from 'vscode';
import * as positron from 'positron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SidebarProvider, RPackageInfo } from './sidebar';

// Polling function to wait for a file to be created
function waitForFile(filePath: string, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (fs.existsSync(filePath)) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for file: ${filePath}`));
      }
    }, 100);
  });
}

export function refreshPackages(sidebarProvider: SidebarProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    const homeDir = os.homedir();
    const packagesDir = path.join(homeDir, 'positron_r_packages');
    if (!fs.existsSync(packagesDir)) {
      try {
        fs.mkdirSync(packagesDir, { recursive: true });
      } catch (err) {
        vscode.window.showErrorMessage(
          'Failed to create directory for R package updates: ' + (err instanceof Error ? err.message : String(err))
        );
        return reject(err);
      }
    }
    const tempFilePath = path.join(packagesDir, `r_packages_${Date.now()}.json`).replace(/\\/g, '/');

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
        path = "${tempFilePath}",
        auto_unbox = TRUE
      )
    `.trim();

    positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent)
      .then(() => {
        // Wait for the file to be created
        waitForFile(tempFilePath)
          .then(() => {
            try {
              const contents = fs.readFileSync(tempFilePath, 'utf-8');
              const parsed: { Package: string; Version: string; LibPath: string; LocationType: string; Title: string; Loaded: boolean }[] = JSON.parse(contents);
              // Clean up the temporary file after reading it
              fs.unlinkSync(tempFilePath);
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
              vscode.window.showErrorMessage(
                'Failed to read or parse R output: ' + (err instanceof Error ? err.message : String(err))
              );
              reject(err);
            }
          })
          .catch(err => {
            vscode.window.showErrorMessage(err.message);
            reject(err);
          });
      }, reject);
  });
}