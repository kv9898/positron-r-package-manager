import * as vscode from 'vscode';
import * as positron from 'positron';

import { SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';

/**
 * Returns a disposable that listens for the onDidRegisterRuntime event.
 * If the registered runtime is an R runtime, it will trigger a call to
 * refreshPackages on the sidebar provider.
 * @param sidebarProvider The SidebarProvider instance to refresh
 * @returns A disposable that can be used to unregister the event
 */
export function getRegisterRuntimeEvent(): vscode.Disposable {
    const RegisterRuntimeEvent = positron.runtime.onDidRegisterRuntime((event) => {
        if (event.languageId !== 'r') { return; };
        vscode.commands.executeCommand("positron-r-package-manager.refreshPackages");
    });
    return RegisterRuntimeEvent;
}

/**
 * Returns a disposable that listens for the onDidChangeForegroundSession event.
 * If the foreground session changes to an R session, it triggers a call to
 * refreshPackages on the sidebar provider.
 * @param sidebarProvider The SidebarProvider instance to refresh
 * @returns A disposable that can be used to unregister the event
 */

export function getChangeForegroundEvent(): vscode.Disposable {
    const ChangeForegroundEvent = positron.runtime.onDidChangeForegroundSession((event) => {
        // Only refresh if the new session is an R session
        if (!event?.startsWith('r-')) { return; };
        vscode.commands.executeCommand("positron-r-package-manager.refreshPackages");
    });

    return ChangeForegroundEvent;
}