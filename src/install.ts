import * as vscode from 'vscode';
import * as positron from 'positron';

import { RPackageItem, SidebarProvider } from './sidebar';
import { refreshPackages } from './refresh';

/**
 * Prompts the user to enter one or more R packages to install, with an option to include dependencies.
 * Executes install.packages() and refreshes the sidebar after completion.
 */
export async function installPackages(sidebarProvider: SidebarProvider): Promise<void> {
    const input = await vscode.window.showInputBox({
      title: 'Install R Packages',
      prompt: 'Packages (separate multiple with space or comma)',
      placeHolder: 'e.g. ggplot2 dplyr tidyr',
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
  
    const rCode = `install.packages(c(${packages}))`;
  
    positron.runtime.executeCode(
      'r',
      rCode,
      true,
      undefined,
      positron.RuntimeCodeExecutionMode.Interactive
    ).then(() => {
      vscode.window.showInformationMessage(`✅ Installed R package(s): ${input}`);
      refreshPackages(sidebarProvider);
    });
  }

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