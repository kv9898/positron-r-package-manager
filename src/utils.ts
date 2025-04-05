import * as vscode from 'vscode';

export function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export function getFilterRedundant(): boolean {
    const config = vscode.workspace.getConfiguration(
        'positron-r-package-manager',
        vscode.Uri.file(vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "")
    );
    // const inspect = config.inspect<boolean>('filterOutdatedIfUpToDateElsewhere');
    // vscode.window.showInformationMessage(`workspace Folder: ${inspect?.workspaceFolderValue}
    //     \nworkspace: ${inspect?.workspaceValue}`);
    return config.get<boolean>('filterOutdatedIfUpToDateElsewhere', true);
}