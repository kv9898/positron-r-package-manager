import * as vscode from 'vscode';
import * as positron from 'positron';
import * as fs from 'fs';

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
 * Gets the configuration value of `showRIcon`.
 *
 * If true, the extension will display a small R logo next to each package in the sidebar to
 * visually indicate package entries.
 *
 * @returns The value of the configuration setting.
 */
export function getShowRIcon(): boolean {
    const config = vscode.workspace.getConfiguration('positron-r-package-manager');
    return config.get<boolean>('showRIcon', false);
}

/**
 * Gets the configuration value of `defaultInstaller`.
 *
 * Returns the default package installer to use: "native" for install.packages()
 * or "pak" for pak::pkg_install().
 *
 * @returns The value of the configuration setting.
 */
export function getDefaultInstaller(): string {
    const config = vscode.workspace.getConfiguration('positron-r-package-manager');
    return config.get<string>('defaultInstaller', 'native');
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
    templateArguments: (string | number | boolean)[] = [],
    onAfterError?: () => void
): positron.runtime.ExecutionObserver {

    function errorHandling(error: string) {
        const fullArgs = [...templateArguments, error];
        // Check for pak-specific error
        if (/pak/i.test(error)) {
            vscode.window.showWarningMessage(
                vscode.l10n.t("The 'pak' package appears to be missing. Would you like to install it?"),
                vscode.l10n.t("Install")
            ).then(selection => {
                if (selection === vscode.l10n.t("Install")) {
                    _installpackages('"pak"', undefined, 'native');
                }
            });
        }
        // Check for jsonlite-specific error
        if (/jsonlite/i.test(error)) {
            vscode.window.showWarningMessage(
                vscode.l10n.t("The 'jsonlite' package appears to be missing. Would you like to install it?"),
                vscode.l10n.t("Install")
            ).then(selection => {
                if (selection === vscode.l10n.t("Install")) {
                    _installpackages('"jsonlite"');
                }
            });
        } else if (/devtools/i.test(error)) {
            vscode.window.showWarningMessage(
                vscode.l10n.t("The 'devtools' package appears to be missing. Would you like to install it?"),
                vscode.l10n.t("Install")
            ).then(selection => {
                if (selection === vscode.l10n.t("Install")) {
                    _installpackages('"devtools"');
                }
            });
        } else if (/readRDS/i.test(error)) {
            const restartLabel = vscode.l10n.t("Restart R");

            vscode.window.showWarningMessage(
                vscode.l10n.t("A readRDS() error was encountered. Please restart R to continue."),
                restartLabel
            ).then(selection => {
                if (selection === restartLabel) {
                    positron.runtime.getForegroundSession().then((session) => {
                        if (session?.metadata.sessionId.startsWith('r-')) {
                            positron.runtime.restartSession(session?.metadata.sessionId);
                        } else {
                            vscode.window.showWarningMessage(
                                vscode.l10n.t("No active R session found in the foreground. Please restart R manually.")
                            );
                        }
                    });
                }
            });
        } else {
            vscode.window.showErrorMessage(vscode.l10n.t(template, ...fullArgs));
            if (onAfterError) { onAfterError(); }
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
 * @param path Optional library path for installation.
 * @param installer Optional installer type override ("native" or "pak").
 *                  If not provided, uses the configured default installer.
 */

export function _installpackages(packages: string, path?: string, installer?: string) {
    if (!installer) { installer = getDefaultInstaller(); }
    // Normalize path for R if provided
    const libOption = path ? `, lib = "${path.replace(/\\/g, '/')}"` : '';

    let rCode: string;

    if (installer === 'pak') {
        rCode = `pak::pkg_install(c(${packages})${libOption})`;
    } else {
        rCode = `install.packages(c(${packages})${libOption})`;
    }

    const observer = getObserver("Error while installing {0}: {1}", [packages]);

    positron.runtime.executeCode(
        'r',
        rCode,
        true,
        undefined,
        positron.RuntimeCodeExecutionMode.Interactive,
        undefined,
        observer
    ).then(() => {
        vscode.commands.executeCommand("positron-r-package-manager.refreshPackages");
    });
}

/**
 * Waits for a file to appear in the file system, periodically checking for its
 * existence until a timeout is reached or the file is found.
 * @param filePath The path to the file to wait for.
 * @param timeout The maximum time to wait for the file to appear, in milliseconds.
 * @returns A promise that resolves when the file is found or rejects when the
 * timeout is reached.
 */
export async function waitForFile(filePath: string, timeout = 1000): Promise<void> {
    return new Promise((resolve, reject) => {
        const start = Date.now();

        const interval = setInterval(() => {
            if (fs.existsSync(filePath)) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - start > timeout) {
                clearInterval(interval);
                const error = new Error(vscode.l10n.t("Timeout waiting for file: {0}", filePath));
                vscode.window.showErrorMessage(error.message);
                reject(error);
            }
        }, 100);
    });
}