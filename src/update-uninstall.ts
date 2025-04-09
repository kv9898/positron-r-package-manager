import * as vscode from 'vscode';
import * as positron from 'positron';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { RPackageItem, SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';
import { getFilterRedundant, getObserver, _installpackages } from './utils';

/**
 * Uninstalls an R package from the active R process.
 * If no item is provided, it will prompt the user to select a package to uninstall.
 * @param item The RPackageItem to uninstall. If undefined, it will prompt the user to select one.
 * @param sidebarProvider The SidebarProvider instance to refresh after uninstalling.
 * @returns A Promise that resolves when the uninstallation is complete.
 */
export async function uninstallPackage(item: RPackageItem | undefined, sidebarProvider: SidebarProvider): Promise<void> {
    await refreshPackages(sidebarProvider);
    if (!item) {
        const all = sidebarProvider.getPackages?.();
        if (!all || all.length === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t('No R packages available to uninstall.'));
            return;
        }

        const selection = await vscode.window.showQuickPick(
            all.map(pkg => ({
                label: `${pkg.name} ${pkg.version} (${pkg.locationtype})`,
                description: `(${pkg.libpath}) ${pkg.title}`,
                pkg
            })),
            {
                title: vscode.l10n.t('Select a package to uninstall'),
                placeHolder: vscode.l10n.t('Please click a package to uninstall'),
                ignoreFocusOut: true
            }
        );

        if (!selection) { return; };

        item = {
            pkg: selection.pkg
        } as RPackageItem;
    }

    const confirm = await vscode.window.showWarningMessage(
        vscode.l10n.t("Uninstall R package {0} {1} ({2})?", item.pkg.name, item.pkg.version, item.pkg.locationtype),
        { modal: true },
        vscode.l10n.t('Yes')
    );

    if (confirm !== vscode.l10n.t('Yes')) { return; };

    const rCode = `
  if ("${item.pkg.name}" %in% loadedNamespaces()) {
    detach("package:${item.pkg.name}", unload = TRUE)
  }
  remove.packages("${item.pkg.name}", lib="${item.pkg.libpath}")
  `.trim();

    const observer = getObserver("Error while uninstalling {0}: {1}", [item!.pkg.name], () => refreshPackages(sidebarProvider));
    positron.runtime.executeCode(
        'r',
        rCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive,
        undefined,
        observer
    ).then(
        () => {
            refreshPackages(sidebarProvider).then(() => {
                const packages = sidebarProvider.getPackages?.() || [];

                const stillExists = packages.some(pkg =>
                    pkg.name === item!.pkg.name && pkg.libpath === item!.pkg.libpath
                );

                if (stillExists) {
                    vscode.window.showErrorMessage(vscode.l10n.t("Failed to uninstall {0} from {1}", item!.pkg.name, item!.pkg.libpath));
                } else {
                    vscode.window.showInformationMessage(vscode.l10n.t("✅ Uninstalled {0}", item!.pkg.name));
                }
            }).catch(err => {
                vscode.window.showErrorMessage(vscode.l10n.t("Error refreshing packages: {0}", err));
            });
        },
    );
}

/**
 * Updates outdated R packages by fetching available updates, prompting the user to select
 * which packages to update, and executing the update process in the R runtime.
 * 
 * This function writes a temporary JSON file containing information about outdated packages,
 * including package name, library path, installed version, and repository version. It then
 * parses the JSON file and filters out packages with up-to-date versions in other library paths.
 * 
 * If there are outdated packages, the user is prompted to select which packages to update.
 * The selected packages are then updated by executing `install.packages()` for each one.
 * 
 * After updating, the package list in the sidebar is refreshed to reflect the changes.
 * 
 * @param sidebarProvider - The SidebarProvider instance responsible for managing the
 *                          R package tree view.
 * @returns A promise that resolves when the update process is complete.
 */

export async function updatePackages(sidebarProvider: SidebarProvider): Promise<void> {
    await refreshPackages(sidebarProvider);
    const tmpPath = path.join(os.tmpdir(), `r_updates_${Date.now()}.json`);
    const rTmpPath = tmpPath.replace(/\\/g, '/');

    const rCode = `
    (function() {
      jsonlite::write_json(
        {
          result <- do.call(rbind, lapply(.libPaths(), function(lib) {
            pkgs <- tryCatch(old.packages(lib.loc = lib), error = function(e) NULL)
            if (is.null(pkgs) || nrow(pkgs) == 0) return(NULL)
    
            data.frame(
              Package = rownames(pkgs),
              LibPath = lib,
              Installed = pkgs[, "Installed"],
              ReposVer = pkgs[, "ReposVer"],
              stringsAsFactors = FALSE
            )
          }))
    
          if (is.null(result)) list() else result[order(result$Package, result$LibPath), ]
        },
        path = "${rTmpPath}",
        auto_unbox = TRUE
      )
    })()
    `.trim();

    const observer = getObserver("Error while fetching updates: {0}", undefined, () => refreshPackages(sidebarProvider));

    // Run R code to dump updates
    await positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent, undefined, observer);

    // Parse updates
    let parsed: { Package: string; LibPath: string; Installed: string; ReposVer: string }[] = [];
    try {
        parsed = parsePackageUpdateJson(tmpPath);
    } catch (err) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to retrieve updatable packages.'));
        return;
    }

    if (getFilterRedundant()) {
        const allInstalled = sidebarProvider.getPackages?.() || [];

        parsed = parsed.filter(outdated => {
            const others = allInstalled.filter(p => p.name === outdated.Package);
            return !others.some(p => p.version === outdated.ReposVer);
        });
    }

    if (parsed.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('✅ All R packages are up to date!'));
        return;
    }

    // Prompt user to select which packages to update
    const selected = await promptPackageUpdateSelection(parsed);
    if (!selected || selected.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No packages selected for update.'));
        return;
    }

    // Build update commands per package
    const updateCommands = selected.map(pkg => {
        const libPath = pkg.LibPath.replace(/\\/g, '/');
        return `install.packages("${pkg.Package}", lib = "${libPath}")`;
    });

    const updateCode = updateCommands.join('\n');

    await positron.runtime.executeCode(
        'r',
        updateCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive
    );

    vscode.window.showInformationMessage(vscode.l10n.t("✅ Updated {0} R package(s) in-place", selected.length));
    refreshPackages(sidebarProvider);
}

/**
 * Reads a JSON file containing package information and returns an array of package
 * information objects with properties 'Package', 'LibPath', 'Installed', and 'ReposVer'.
 * If the file is empty, or contains invalid JSON, an empty array is returned.
 *
 * This function is used to parse the result of a temporary R script that dumps package
 * information in JSON format. The script is executed by the updatePackages() function.
 *
 * @param tmpPath - the path to the temporary JSON file to read
 * @returns an array of package information objects
 */
function parsePackageUpdateJson(tmpPath: string): { Package: string; LibPath: string; Installed: string; ReposVer: string }[] {
    const content = fs.readFileSync(tmpPath, 'utf-8').trim();

    // Optional: clean up
    try {
        fs.unlinkSync(tmpPath);
    } catch (unlinkErr) {
        console.warn(vscode.l10n.t('[Positron] Failed to delete temp file: '), unlinkErr);
        // No user-facing message, just dev-side warning
    }

    if (content === '{}' || content === '[]' || content === 'null') {
        return [];
    }

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.length === 0) {
        return [];
    }

    return parsed;
}

/**
 * Shows a QuickPick selection UI to the user, given a list of parsed package
 * information objects. The user is prompted to select which packages to update.
 *
 * Each package information object should have the following properties:
 * - `Package`: the name of the package
 * - `LibPath`: the path to the library directory where the package is installed
 * - `Installed`: the currently installed version of the package
 * - `ReposVer`: the version of the package available from the repository
 *
 * The function returns a promise that resolves to the array of selected package
 * information objects, or undefined if the user cancels the selection.
 */
async function promptPackageUpdateSelection(
    parsed: { Package: string; LibPath: string; Installed: string; ReposVer: string }[]
): Promise<typeof parsed | undefined> {
    const items = parsed.map(pkg => ({
        label: `${pkg.Package}  (${pkg.Installed} → ${pkg.ReposVer})`,
        description: pkg.LibPath,
        picked: true,
        ...pkg
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: vscode.l10n.t('Select R packages to update'),
        canPickMany: true,
        placeHolder: vscode.l10n.t('Choose package installs to update'),
        ignoreFocusOut: true
    });

    return selected;
}