import * as vscode from 'vscode';
import * as positron from 'positron';

import { RPackageItem, SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';

export function uninstallPackage(item: RPackageItem, sidebarProvider: SidebarProvider) {
    vscode.window.showWarningMessage(`Uninstall ${item.pkg.name}?`, 'Yes', 'No')
        .then(response => {
            if (response === 'Yes') {
                const rCode = `
  if ("${item.pkg.name}" %in% loadedNamespaces()) {
    detach("package:${item.pkg.name}", unload = TRUE)
  }
  remove.packages("${item.pkg.name}")
  `.trim();

                positron.runtime.executeCode(
                    'r',
                    rCode,
                    true,
                    undefined,
                    positron.RuntimeCodeExecutionMode.Interactive
                ).then(() => {
                    vscode.window.showInformationMessage(`Uninstalled R package: ${item.pkg.name}`);
                    refreshPackages(sidebarProvider);
                });
            }
        });
}