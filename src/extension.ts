// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as positron from 'positron';
import { refreshPackages } from './refresh';
import { SidebarProvider, RPackageItem } from './sidebar';
import { uninstallPackage } from './install';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const sidebarProvider = new SidebarProvider();

	// Automatically refresh packages once the R runtime is ready
	positron.runtime.getForegroundSession().then(session => {
		if (session?.runtimeMetadata.languageId === 'r') {
			refreshPackages(sidebarProvider);
		}
	});

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "positron-r-package-manager" sees its sidebar refreshed!');

	context.subscriptions.push(
		vscode.commands.registerCommand('positron-r-package-manager.refreshPackages', () => {
			refreshPackages(sidebarProvider);
		})
	);

	// handle sidebar
	const treeView = vscode.window.createTreeView('rPackageView', {
		treeDataProvider: sidebarProvider,
		showCollapseAll: false,
		canSelectMany: false
	});
	treeView.onDidChangeCheckboxState((event) => {
		for (const [item, newState] of event.items) {
			sidebarProvider.handleCheckboxChange(item, newState);
		}
	});
	treeView.onDidChangeVisibility((event) => {
		if (event.visible) {
			refreshPackages(sidebarProvider); // ✅ Refresh package data when the view becomes visible
		}
	});

	context.subscriptions.push(
		// help topic provider
		vscode.commands.registerCommand('positron-r-package-manager.openHelp', (pkgName: string) => {
			const rCode = `help(package = "${pkgName}")`;
			positron.runtime.executeCode('r', rCode, true, undefined, positron.RuntimeCodeExecutionMode.Silent);
		}),


		// search package provider
		vscode.commands.registerCommand('positron-r-package-manager.searchPackages', async () => {
			const input = await vscode.window.showInputBox({
				prompt: 'Search R packages — press Esc to clear filter, Enter to apply',
				value: sidebarProvider.getFilter(),
				placeHolder: 'e.g. plot',
			});

			sidebarProvider.setFilter(input ?? '');

		}),

		// install packages (incomplete)
		vscode.commands.registerCommand('positron-r-package-manager.installPackage', () => {
			vscode.window.showInformationMessage('Install Package (not implemented)');
		}),
		// uninstall packages
		vscode.commands.registerCommand('positron-r-package-manager.uninstallPackage', (item: RPackageItem) => {
			uninstallPackage(item, sidebarProvider);
		}),
		// update packages (incomplete)
		vscode.commands.registerCommand('positron-r-package-manager.updatePackages', () => {
			vscode.window.showInformationMessage('Update Packages (not implemented)');
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }