import * as vscode from 'vscode';
import * as positron from 'positron';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { RPackageItem, SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';

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
                label: `${pkg.name} ${pkg.version}`,
                description: pkg.title,
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
        `Uninstall ${item.pkg.name}?`,
        { modal: true },
        'Yes'
    );

    if (confirm !== 'Yes') { return; };

    const rCode = `
  if ("${item.pkg.name}" %in% loadedNamespaces()) {
    detach("package:${item.pkg.name}", unload = TRUE)
  }
  remove.packages("${item.pkg.name}")
  `.trim();

    positron.runtime.executeCode(
        'r',
        rCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive
    ).then(() => {
        vscode.window.showInformationMessage(`✅ Uninstalled ${item!.pkg.name}`);
        refreshPackages(sidebarProvider);
    });
}

export async function updatePackages(sidebarProvider: SidebarProvider): Promise<void> {
    const tmpPath = path.join(os.tmpdir(), `r_updates_${Date.now()}.json`).replace(/\\/g, '/');

    const rCode = `
    if (is.null(old.packages())) {
      jsonlite::write_json(NULL, path = "${tmpPath}", auto_unbox = TRUE)
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

    // Fetch the list of updatable packages
    await positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent);

    let parsed: { Package: string; Installed: string; ReposVer: string }[];

    try {
        const content = fs.readFileSync(tmpPath, 'utf-8');
        fs.unlinkSync(tmpPath);

        if (!content || content.trim() === '{}' ||  content.trim() === 'null') {
            vscode.window.showInformationMessage('✅ All R packages are up to date!');
            return;
        }

        parsed = JSON.parse(content);

    } catch (err) {
        vscode.window.showErrorMessage('Failed to retrieve updatable packages.');
        return;
    }

    if (!parsed || parsed.length === 0) {
        vscode.window.showInformationMessage('✅ All R packages are up to date!');
        return;
    }

    const items = parsed.map(pkg => ({
        label: `${pkg.Package}  (${pkg.Installed} → ${pkg.ReposVer})`,
        picked: true,
        pkg: pkg.Package
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: 'Select R packages to update',
        canPickMany: true,
        placeHolder: 'Check/uncheck packages to update',
        ignoreFocusOut: true
    });

    if (!selected || selected.length === 0) {
        vscode.window.showInformationMessage('No packages selected for update.');
        return;
    }

    const updateList = selected.map(item => `"${item.pkg}"`).join(', ');
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
