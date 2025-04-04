import * as vscode from 'vscode';
import * as positron from 'positron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SidebarProvider, RPackageInfo } from './sidebar';

export function refreshPackages(sidebarProvider: SidebarProvider) {
    // The code you place here will be executed every time your command is executed
    // Load Tidyverse package
    const tempFilePath = path.join(os.tmpdir(), `r_packages_${Date.now()}.json`).replace(/\\/g, '/');

    // R code to write installed + loaded package info to JSON

    const rCode = `
    jsonlite::write_json(
      within(
        as.data.frame(installed.packages()[, c("Package", "Version")]),
        {
            Title <- vapply(Package, function(pkg) packageDescription(pkg, fields = "Title"), character(1))
            Loaded <- Package %in% loadedNamespaces()
        }
      ),
      path = "${tempFilePath}",
      auto_unbox = TRUE
    )
    `.trim();

    positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent).then(() => {
        try {
            const contents = fs.readFileSync(tempFilePath, 'utf-8');
            const parsed: { Package: string; Version: string; Loaded: boolean; Title: string }[] = JSON.parse(contents);

            // // Count loaded packages
            // const loadedCount = parsed.filter(pkg => pkg.loaded).length;
            // const totalCount = parsed.length;

            // // Show result
            // vscode.window.showInformationMessage(`✔️ ${loadedCount} loaded out of ${totalCount} installed R packages.`);

            // Optional: clean up
            fs.unlinkSync(tempFilePath);

            const pkgInfo: RPackageInfo[] = parsed.map(pkg => ({
                name: pkg.Package,
                version: pkg.Version,
                title: pkg.Title,
                loaded: pkg.Loaded
              }));

            sidebarProvider.refresh(pkgInfo);
        } catch (err) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage('Failed to read or parse R output: ' + err.message);
            } else {
                vscode.window.showErrorMessage('Failed to read or parse R output: ' + String(err));
            }
        }
    });
};