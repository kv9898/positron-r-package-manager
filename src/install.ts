import * as vscode from 'vscode';
import * as positron from 'positron';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { RPackageItem, SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';
import { getFilterRedundant, getObserver, _installpackages } from './utils';

/**
 * Install R packages from the command palette.
 *
 * This function prompts the user for package names, splits the input
 * into separate packages, and then runs `install.packages()` in the
 * R runtime. After the installation is complete, it shows a success
 * message and refreshes the package list.
 *
 * @param sidebarProvider The {@link SidebarProvider} instance to refresh after installation.
 */
export async function installPackages(sidebarProvider: SidebarProvider): Promise<void> {
    // get lib paths
    const paths = await getLibPaths();

    await installUI(paths[0]);
}

async function getLibPaths(): Promise<string[]> {

    const tmpPath = path.join(os.tmpdir(), `r_libPaths_${Date.now()}.json`);
    const rTmpPath = tmpPath.replace(/\\/g, '/');

    const rCode = `
    jsonlite::write_json(
      .libPaths(),
      path = "${rTmpPath}",
      auto_unbox = FALSE
    )
    `.trim();

    const observer = getObserver("Error while fetching library paths: {0}");

    // Run R code to dump updates
    await positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent, undefined, observer);

    // Parse Json
    try {
        const content = fs.readFileSync(tmpPath, 'utf-8').trim();
        const parsed: string[] = JSON.parse(content);

        try {
            fs.unlinkSync(tmpPath); // Safe delete
        } catch (unlinkErr) {
            console.warn(vscode.l10n.t('[Positron] Failed to delete temp file: '), unlinkErr);
            // No user-facing message, just dev-side warning
        }

        return parsed;
    } catch (err) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to read library paths from R output: {0}', err instanceof Error ? err.message : String(err)));
        return [];
    }
}

async function installUI(path: string): Promise<void> {
    const options = [
        { label: vscode.l10n.t('Install from CRAN (Recommended)'), value: 'cran' },
        { label: vscode.l10n.t('Install from GitHub'), value: 'github' },
        { label: vscode.l10n.t('Install from local archive (.tar.gz or .zip)'), value: 'local' },
        {
          label: vscode.l10n.t("Install to another directory (current: {0})", path),
          value: 'customLib'
        }
      ];
    
    const selection = await vscode.window.showQuickPick(options, {
        title: vscode.l10n.t('Select installation method'),
        placeHolder: vscode.l10n.t('Where would you like to install packages from?'),
        ignoreFocusOut: true
      });

      
    switch (selection?.value) {
        case 'cran':
            await installFromCran();
            break;
        case 'github':
            break;
        case 'local':
            break;
    }
}

async function installFromCran(): Promise<void> {
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

    _installpackages(packages);
}

