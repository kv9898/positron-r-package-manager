import * as vscode from 'vscode';
import * as positron from 'positron';

import { SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';

/**
 * Remove ANSI escape codes from a string, so that only the plain text remains.
 * This is for making error messages more readable.
 * @param text The string to remove escape codes from.
 * @returns The string with escape codes removed.
 */
export function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Gets the configuration value of `filterOutdatedIfUpToDateElsewhere`.
 *
 * If true, the extension will filter out outdated packages if an up-to-date version
 * exists in another library during updates.
 *
 * @returns The value of the configuration setting.
 */
export function getFilterRedundant(): boolean {
    const config = vscode.workspace.getConfiguration(
        'positron-r-package-manager',
        vscode.Uri.file(vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "")
    );
    return config.get<boolean>('filterOutdatedIfUpToDateElsewhere', true);
}

/**
 * Returns an ExecutionObserver that shows an error message using the given template
 * string, formatted with the given template arguments. If the error is due to a
 * missing 'jsonlite' package, it will prompt the user to install it. Optionally,
 * it can call a function after the error handling is finished.
 * @param template The vscode.l10n template string to use for the error message.
 * @param sidebarProvider The SidebarProvider to use for installing the jsonlite
 *     package if necessary.
 * @param templateArguments An array of arguments to pass to the template string, before the error message.
 * @param onAfterError An optional function to call after the error handling is finished.
 */
export function getObserver(
    template: string,
    sidebarProvider: SidebarProvider,
    templateArguments: (string | number | boolean)[] = [],
    onAfterError?: () => void
): positron.runtime.ExecutionObserver {

    function errorHandling(error: string) {
        const fullArgs = [...templateArguments, error];
        vscode.window.showErrorMessage(vscode.l10n.t(template, ...fullArgs));
        // Check for jsonlite-specific error
        if (/jsonlite/i.test(error)) {
            vscode.window.showWarningMessage(
                vscode.l10n.t("The 'jsonlite' package appears to be missing. Would you like to install it?"),
                vscode.l10n.t("Install")
            ).then(selection => {
                if (selection === vscode.l10n.t("Install")) {
                    _installpackages('"jsonlite"', sidebarProvider);
                    if (onAfterError) {
                        onAfterError();
                    }
                }
            });
        } else if (onAfterError) {
            onAfterError();
        }
    }

    const observer: positron.runtime.ExecutionObserver = {
        // onError: (error: string) => {
        //     errorHandling(stripAnsi(error));
        // },
        onFailed: (error: Error) => {
            errorHandling(stripAnsi(error.message));
        }
    };
    return observer;
}

/**
 * Installs one or more R packages from the command line.
 * @param packages A comma-separated string of R package names to install.
 * @param sidebarProvider The SidebarProvider instance to refresh after installation.
 * @returns A promise that resolves when the installation is complete.
 */

export function _installpackages(packages: string, sidebarProvider: SidebarProvider) {
        const rCode = `install.packages(c(${packages}))`;
    
        const observer= getObserver("Error while installing {0}: {1}", sidebarProvider, [packages], () => refreshPackages(sidebarProvider));
        positron.runtime.executeCode(
            'r',
            rCode,
            true,
            undefined,
            positron.RuntimeCodeExecutionMode.Interactive,
            undefined,
            observer
        ).then(() => {
            vscode.window.showInformationMessage(vscode.l10n.t('✅ Installed R package(s): {0}', packages));
            refreshPackages(sidebarProvider);
        });
}