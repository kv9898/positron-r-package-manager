import * as vscode from 'vscode';
import * as positron from 'positron';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { RPackageItem, SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';
import { stripAnsi, getFilterRedundant } from './utils';

/**
 * Prompts the user to enter one or more R packages to install, with an option to include dependencies.
 * Executes install.packages() and refreshes the sidebar after completion.
 */
export async function installPackages(sidebarProvider: SidebarProvider): Promise<void> {
    const input = await vscode.window.showInputBox({
        title: 'Install R Packages',
        prompt: 'Packages (separate multiple with space or comma)',
        placeHolder: 'e.g. ggplot2 dplyr tidyr',
        ignoreFocusOut: true,
    });

    if (!input?.trim()) {
        return;
    }

    const packages = input
        .split(/[\s,]+/)
        .filter(pkg => pkg.length)
        .map(pkg => `"${pkg}"`)
        .join(', ');

    const rCode = `install.packages(c(${packages}))`;

    positron.runtime.executeCode(
        'r',
        rCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive
    ).then(() => {
        vscode.window.showInformationMessage(`✅ Installed R package(s): ${input}`);
        refreshPackages(sidebarProvider);
    });
}

export async function uninstallPackage(item: RPackageItem | undefined, sidebarProvider: SidebarProvider): Promise<void> {
    if (!item) {
        const all = sidebarProvider.getPackages?.();
        if (!all || all.length === 0) {
            vscode.window.showInformationMessage('No R packages available to uninstall.');
            return;
        }

        const selection = await vscode.window.showQuickPick(
            all.map(pkg => ({
                label: `${pkg.name} ${pkg.version} (${pkg.locationtype})`,
                description: `(${pkg.libpath}) ${pkg.title}`,
                pkg
            })),
            {
                title: 'Select a package to uninstall',
                placeHolder: 'Choose a package',
                ignoreFocusOut: true
            }
        );

        if (!selection) { return; };

        item = {
            pkg: selection.pkg
        } as RPackageItem;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Uninstall R package ${item.pkg.name} ${item.pkg.version} (${item.pkg.locationtype})?`,
        { modal: true },
        'Yes'
    );

    if (confirm !== 'Yes') { return; };

    const rCode = `
  if ("${item.pkg.name}" %in% loadedNamespaces()) {
    detach("package:${item.pkg.name}", unload = TRUE)
  }
  remove.packages("${item.pkg.name}", lib="${item.pkg.libpath}")
  `.trim();

    const observer: positron.runtime.ExecutionObserver = {
        onError: (error: string) => {
            error = stripAnsi(error);
            vscode.window.showErrorMessage(`Error while uninstalling ${item!.pkg.name}: ${error}`);
            refreshPackages(sidebarProvider);
        },
        onFailed: (error: Error) => {
            const message = stripAnsi(error.message);
            vscode.window.showErrorMessage(`Error while uninstalling ${item!.pkg.name}: ${message}`);
            refreshPackages(sidebarProvider);
        },
    };
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
                    vscode.window.showErrorMessage(`Failed to uninstall ${item!.pkg.name} from ${item!.pkg.libpath}`);
                } else {
                    vscode.window.showInformationMessage(`✅ Uninstalled ${item!.pkg.name}`);
                }
            }).catch(err => {
                vscode.window.showErrorMessage(`Error refreshing packages: ${err}`);
            });
        },
    );
}

export async function updatePackages(sidebarProvider: SidebarProvider): Promise<void> {
    vscode.window.showInformationMessage(`filter? ${getFilterRedundant()}`);
    const tmpPath = path.join(os.tmpdir(), `r_updates_${Date.now()}.json`).replace(/\\/g, '/');

    const rCode = `
  if (is.null(old.packages())) {
    jsonlite::write_json(list(), path = "${tmpPath}", auto_unbox = TRUE)
  } else {
    pkgs <- old.packages()
    df <- data.frame(
      Package = rownames(pkgs),
      Installed = pkgs[, "Installed"],
      ReposVer = pkgs[, "ReposVer"]
    )
    jsonlite::write_json(df, path = "${tmpPath}", auto_unbox = TRUE)
  }
  `.trim();

    // Run R code to dump updates
    await positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent);

    // Try to parse result from file
    let parsed = parsePackageUpdateJson(tmpPath);
    if (!parsed) {
        vscode.window.showInformationMessage('✅ All R packages are up to date!');
        return;
    }

    if (getFilterRedundant()) {
        const allInstalled = sidebarProvider.getPackages?.() || [];
    
        parsed = parsed.filter(outdated => {
            const others = allInstalled.filter(p => p.name === outdated.Package);
    
            return !others.some(p => p.version === outdated.ReposVer);
        });
    }

    // Prompt user to select which packages to update
    const selected = await promptPackageUpdateSelection(parsed);
    if (!selected || selected.length === 0) {
        vscode.window.showInformationMessage('No packages selected for update.');
        return;
    }

    // Execute update for selected packages
    const updateList = selected.map(pkg => `"${pkg.Package}"`).join(', ');
    const updateCode = `install.packages(c(${updateList}))`;

    positron.runtime.executeCode(
        'r',
        updateCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive
    ).then(() => {
        vscode.window.showInformationMessage(`✅ Updated ${selected.length} R package(s)`);
        refreshPackages(sidebarProvider);
    });
}

function parsePackageUpdateJson(tmpPath: string): { Package: string; Installed: string; ReposVer: string }[] | null {
    try {
        const content = fs.readFileSync(tmpPath, 'utf-8').trim();
        fs.unlinkSync(tmpPath);

        if (content === '{}' || content === '[]' || content === 'null') {
            return null;
        }

        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return null;
        }

        return parsed;
    } catch (err) {
        vscode.window.showErrorMessage('❌ Failed to retrieve updatable packages.');
        return null;
    }
}

async function promptPackageUpdateSelection(
    parsed: { Package: string; Installed: string; ReposVer: string }[]
): Promise<{ Package: string }[] | undefined> {
    const items = parsed.map(pkg => ({
        label: `${pkg.Package}  (${pkg.Installed} → ${pkg.ReposVer})`,
        picked: true,
        Package: pkg.Package
    }));

    return await vscode.window.showQuickPick(items, {
        title: 'Select R packages to update',
        canPickMany: true,
        placeHolder: 'Check/uncheck packages to update',
        ignoreFocusOut: true
    });
}
