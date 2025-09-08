import * as vscode from 'vscode';
import * as positron from 'positron';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SidebarProvider } from './sidebar';
import { getObserver, _installpackages, getDefaultInstaller, isLibPathWriteable } from './utils';

/**
 * Install R packages from the command palette.
 *
 * This function prompts the user for package names, splits the input
 * into separate packages, and then runs package installation in the
 * R runtime. After the installation is complete, it shows a success
 * message and refreshes the package list.
 *
 * @param sidebarProvider The {@link SidebarProvider} instance to refresh after installation.
 */
export async function installPackages(): Promise<void> {
    // get lib paths
    const paths = await getLibPaths();

    for (const path of paths) {
        if (isLibPathWriteable(path)) {
            await installUI(path);
            return;
        }
    }

    vscode.window.showWarningMessage(
        vscode.l10n.t("None of the library paths are writeable. Please select a custom path.")
    );
    changeLibPath(); // fire and forget
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
            await installFromCran(path);
            break;
        case 'github':
            await installFromGithub(path);
            break;
        case 'local':
            await installFromLocal(path);
            break;
        case 'customLib':
            void changeLibPath(); // fire and forget
            break;
    }
}

async function installFromCran(libPath: string): Promise<void> {
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

    _installpackages(packages, libPath);
}

async function installFromGithub(libPath: string): Promise<void> {
    const repo = await vscode.window.showInputBox({
        title: vscode.l10n.t('Install from GitHub'),
        prompt: vscode.l10n.t('Enter GitHub repo (e.g., tidyverse/ggplot2 or user/repo@v1.2.3)'),
        ignoreFocusOut: true,
    });
    if (!repo?.trim()) { return; };

    const esc = (s: string) => s.replace(/\\/g, "/").replace(/"/g, '\\"');
    const libOpt = libPath ? `, lib = "${esc(libPath)}"` : "";

    const installer = getDefaultInstaller();

    const rCode =
        installer === "pak"
            ? `pak::pkg_install("${esc(repo.trim())}"${libOpt}, ask = FALSE)`
            : `withr::with_libpaths(${libPath ? `"${esc(libPath)}"` : ".libPaths()[1]"}, devtools::install_github("${esc(repo.trim())}"))`;

    const observer = getObserver("Error while installing from {0}: {1}", [repo]);
    await positron.runtime.executeCode(
        "r",
        rCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive,
        undefined,
        observer
    );

    vscode.commands.executeCommand("positron-r-package-manager.refreshPackages");
}

async function installFromLocal(libPath: string): Promise<void> {
    const result = await vscode.window.showOpenDialog({
        filters: { 'R Packages': ['tar.gz', 'zip'] },
        canSelectMany: false,
        openLabel: vscode.l10n.t('Install package')
    });

    if (!result || !result[0]) { return; };
    ;
    const path = result[0].fsPath.replace(/\\/g, '/');

    const installer = getDefaultInstaller();
    const libOption = libPath ? `, lib = "${libPath.replace(/\\/g, '/')}"` : '';

    let rCode: string;

    if (installer === 'pak') {
        rCode = `pak::local_install("${path}"${libOption})`;
    } else {
        const isZip = path.toLowerCase().endsWith(".zip");
        const type = isZip ? "win.binary" : "source";
        rCode = `install.packages("${path}", repos = NULL, type = "${type}"${libOption})`;
    }

    const observer = getObserver("Error while installing local package: {0}");
    await positron.runtime.executeCode(
        'r',
        rCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive,
        undefined,
        observer
    );
    vscode.commands.executeCommand("positron-r-package-manager.refreshPackages");
    return;
}

export async function changeLibPath(): Promise<void> {
    const existingPaths = await getLibPaths();

    const qp = vscode.window.createQuickPick();
    qp.title = vscode.l10n.t('Select Library Path');
    qp.placeholder = vscode.l10n.t('Choose an existing path or type a new one');
    qp.ignoreFocusOut = true;

    const baseItems: (vscode.QuickPickItem & { id?: string })[] = [
        ...existingPaths.map(p => ({
            label: p,
            description: vscode.l10n.t('Existing library path')
        })),
        {
            id: 'browse',
            label: vscode.l10n.t('📁 Browse for a new library path...'),
            description: vscode.l10n.t('Select a custom directory')
        }
    ];

    qp.items = baseItems;
    qp.show();

    qp.onDidAccept(async () => {
        const input = qp.value.trim().replace(/\\/g, '/');
        let finalPath: string | undefined;

        const selected = qp.selectedItems[0] as (vscode.QuickPickItem & { id?: string });

        // Case 1: Browse
        if (selected?.id === 'browse') {
            const folder = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: vscode.l10n.t('Use as Library Path')
            });

            if (folder?.length) {
                finalPath = folder[0].fsPath.replace(/\\/g, '/');
            }
        }

        // Case 2: Picked from existing list
        else if (selected) {
            finalPath = selected.label;
        }

        // Case 3: Manually typed
        else if (input) {
            if (fs.existsSync(input)) {
                finalPath = input.trim();
            } else {
                try {
                    fs.mkdirSync(input, { recursive: true });
                    finalPath = input;
                } catch (err) {
                    vscode.window.showErrorMessage(vscode.l10n.t('Failed to create directory: {0}', String(err)));
                }
            }
        }

        qp.hide();

        if (finalPath) {
            if (!isLibPathWriteable(finalPath)) {
                vscode.window.showErrorMessage(vscode.l10n.t('The selected path is not writeable. Please choose another path.'));
                void changeLibPath(); // fire and forget
                return;
            }
            await installUI(finalPath);
        } else {
            vscode.window.showInformationMessage(vscode.l10n.t('No library path selected, please try again.'));
            void changeLibPath(); // fire and forget
            return;
        }
    });
}
