import * as vscode from 'vscode';
import * as positron from 'positron';

import { SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';

export function getRegisterRuntimeEvent(sidebarProvider: SidebarProvider): vscode.Disposable {
    const RegisterRuntimeEvent = positron.runtime.onDidRegisterRuntime((event) => {
        if (event.languageId !== 'r') { return; };
        refreshPackages(sidebarProvider);
    });
    return RegisterRuntimeEvent;
}

export function getChangeForegroundEvent(sidebarProvider: SidebarProvider): vscode.Disposable {
    const ChangeForegroundEvent = positron.runtime.onDidChangeForegroundSession((event) => {
        // if (event.languageId !== 'r') { return; };
        refreshPackages(sidebarProvider);
    });
    return ChangeForegroundEvent;
}