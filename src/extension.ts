// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as positron from 'positron';
import { refreshPackages } from './refresh';
import { SidebarProvider, RPackageItem } from './sidebar';
import { installPackages } from './install';
import { uninstallPackage, updatePackages } from './update-uninstall';
import { getChangeForegroundEvent } from './events';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const sidebarProvider = new SidebarProvider();

	// Refresh the package list upon new R runtime or switched R foreground session
	// const registerRuntimeEvent = getRegisterRuntimeEvent();
	const changeForegroundEvent = getChangeForegroundEvent();
	context.subscriptions.push(changeForegroundEvent);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "positron-r-package-manager" sees its sidebar refreshed!');

	vscode.commands.registerCommand('positron-r-package-manager.refreshPackages', async () => {
		// const hasR = await positron.runtime.getRegisteredRuntimes().then((runtimes) => runtimes.some((runtime) => runtime.languageId === 'r'));

		const hasR  = await positron.runtime.getActiveSessions().then((sessions) => sessions.some((session) => session.runtimeMetadata.languageId === 'r'));
		if (!hasR) {
			vscode.window.showWarningMessage(
				vscode.l10n.t('No active R console session available. Please start one.')
			);
			return;
		}

		await refreshPackages(sidebarProvider);
	});

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
	treeView.onDidChangeVisibility(async (event) => {
		if (event.visible) {
			const hasR = await positron.runtime.getRegisteredRuntimes().then((runtimes) => runtimes.some((runtime) => runtime.languageId === 'r'));
			if (hasR) {
				refreshPackages(sidebarProvider);
			}
		}
	});

	context.subscriptions.push(
		// help topic provider
		vscode.commands.registerCommand('positron-r-package-manager.openHelp', (pkgName: string) => {
			const rCode = `help(package = "${pkgName}")`;
			positron.runtime.executeCode('r', rCode, false, undefined, positron.RuntimeCodeExecutionMode.Silent);
		}),


		// search package provider
		vscode.commands.registerCommand('positron-r-package-manager.searchPackages', async () => {
			const input = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Search R packages — press Esc to clear filter, Enter to apply'),
				value: sidebarProvider.getFilter(),
				placeHolder: vscode.l10n.t('e.g. plot'),
			});

			sidebarProvider.setFilter(input ?? '');

		}),

		// install packages
		vscode.commands.registerCommand('positron-r-package-manager.installPackages', () => {
			installPackages();
		}),
		// uninstall packages
		vscode.commands.registerCommand('positron-r-package-manager.uninstallPackage', (item: RPackageItem | undefined) => {
			uninstallPackage(item, sidebarProvider);
		}),
		// update packages
		vscode.commands.registerCommand('positron-r-package-manager.updatePackages', () => {
			updatePackages(sidebarProvider);
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }