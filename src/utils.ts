import * as vscode from 'vscode';

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