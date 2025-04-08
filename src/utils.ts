import * as vscode from 'vscode';
import * as positron from 'positron';

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

export function getObserver(
    template: string,
    templateArguments: (string | number | boolean)[] = [],
    func?: () => void
): positron.runtime.ExecutionObserver {

    function errorHandling(error: string) {
        const fullArgs = [...templateArguments, error];
        vscode.window.showErrorMessage(vscode.l10n.t(template, ...fullArgs));
        if (func) {
            func();
        }
    }

    const observer: positron.runtime.ExecutionObserver = {
        onError: (error: string) => {
            error = stripAnsi(error);
            errorHandling(error);
        },
        onFailed: (error: Error) => {
            const message = stripAnsi(error.message);
            errorHandling(message);
        },
    };
    return observer;
}

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