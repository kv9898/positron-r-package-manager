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
        title: vscode.l10n.t('Install R Packages'),
        prompt: vscode.l10n.t('Packages (separate multiple with space or comma)'),
        placeHolder: vscode.l10n.t('e.g. ggplot2 dplyr tidyr'),
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
        vscode.window.showInformationMessage(vscode.l10n.t('✅ Installed R package(s): {0}', input));
        refreshPackages(sidebarProvider);
    });
}

export async function uninstallPackage(item: RPackageItem | undefined, sidebarProvider: SidebarProvider): Promise<void> {
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
            vscode.window.showErrorMessage(vscode.l10n.t("Error while uninstalling {0}: {1}", item!.pkg.name, error));
            refreshPackages(sidebarProvider);
        },
        onFailed: (error: Error) => {
            const message = stripAnsi(error.message);
            vscode.window.showErrorMessage(vscode.l10n.t("Error while uninstalling {0}: {1}", item!.pkg.name, message));
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

export async function updatePackages(sidebarProvider: SidebarProvider): Promise<void> {
    const tmpPath = path.join(os.tmpdir(), `r_updates_${Date.now()}.json`);
    const rTmpPath = tmpPath.replace(/\\/g, '/');

    const rCode = `
    jsonlite::write_json(
      {
        df <- do.call(rbind, lapply(.libPaths(), function(lib) {
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
        if (is.null(df)) list() else df[order(df$Package, df$LibPath), ]
      },
      path = "${rTmpPath}",
      auto_unbox = TRUE
    )
    `.trim();

    // Run R code to dump updates
    await positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent);

    // Parse updates
    let parsed = parsePackageUpdateJson(tmpPath) ?? [];

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

function parsePackageUpdateJson(tmpPath: string): { Package: string; LibPath: string; Installed: string; ReposVer: string }[] | null {
    try {
        const content = fs.readFileSync(tmpPath, 'utf-8').trim();

        // Optional: clean up
        try {
            fs.unlinkSync(tmpPath);
        } catch (unlinkErr) {
            console.warn(vscode.l10n.t('[Positron] Failed to delete temp file: '), unlinkErr);
            // No user-facing message, just dev-side warning
        }

        if (content === '{}' || content === '[]' || content === 'null') {
            return null;
        }

        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return null;
        }

        return parsed;
    } catch (err) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to retrieve updatable packages.'));
        return null;
    }
}

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
