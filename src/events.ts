import * as vscode from 'vscode';
import * as positron from 'positron';

/**
 * Returns a disposable that listens for the onDidRegisterRuntime event.
 * If the registered runtime is an R runtime, it will trigger a call to
 * refreshPackages on the sidebar provider.
 * @param sidebarProvider The SidebarProvider instance to refresh
 * @returns A disposable that can be used to unregister the event
 */
// export function getRegisterRuntimeEvent(): vscode.Disposable {
//     const RegisterRuntimeEvent = positron.runtime.onDidRegisterRuntime((event) => {
//         if (event.languageId !== 'r') { return; };
//         vscode.commands.executeCommand("positron-r-package-manager.refreshPackages");
//     });
//     return RegisterRuntimeEvent;
// }

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

/**
 * Returns a disposable that listens for R code execution events related to package loading or unloading.
 * 
 * When the user executes R code that includes `library()`, `require()`, `pacman::p_load()`, or `detach()`,
 * this event handler waits briefly and then triggers a refresh of the R package list in the sidebar.
 * 
 * @returns {vscode.Disposable} A disposable that unregisters the event listener.
 */
export function getLoadLibraryEvent(): vscode.Disposable {
    const LoadLibraryEvent = positron.runtime.onDidExecuteCode(event => {
        if (event.languageId !== 'r') { return; };
        if (event.code.includes('library(') || event.code.includes('require(') || event.code.includes('pacman::p_load(') || event.code.includes('detach(')) {
            // wait a moment to ensure the package is loaded
            setTimeout(() => {
                vscode.commands.executeCommand("positron-r-package-manager.refreshPackages");
            }, 500);
        };
    });

    return LoadLibraryEvent;
}