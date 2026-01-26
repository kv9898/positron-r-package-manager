// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { tryAcquirePositronApi } from '@posit-dev/positron';
import { setPositron } from './positronApi';
import { refreshPackages } from './refresh';
import { RPackageWebviewProvider } from './webviewProvider';
import { installPackages } from './install';
import { uninstallPackage, updatePackages } from './update-uninstall';
import { getChangeForegroundEvent, getLoadLibraryEvent } from './events';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const positron = tryAcquirePositronApi();

	if (!positron) {
		console.error('Positron API is not available.');
		return;
	}

	// Make the Positron API available to other modules via the shared getter
	setPositron(positron);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const webviewProvider = new RPackageWebviewProvider(context.extensionUri);

	// Register the webview provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			RPackageWebviewProvider.viewType,
			webviewProvider
		)
	);

	// Refresh the package list upon new R runtime or switched R foreground session
	// const registerRuntimeEvent = getRegisterRuntimeEvent();
	const changeForegroundEvent = getChangeForegroundEvent();
	context.subscriptions.push(changeForegroundEvent);

	// Refresh the package list upon package loading/unloading
	const loadLibraryEvent = getLoadLibraryEvent();
	context.subscriptions.push(loadLibraryEvent);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "positron-r-package-manager" sees its sidebar refreshed!');

	vscode.commands.registerCommand('positron-r-package-manager.refreshPackages', async () => {
		// const hasR = await positron.runtime.getRegisteredRuntimes().then((runtimes) => runtimes.some((runtime) => runtime.languageId === 'r'));

		const hasR = await positron.runtime.getActiveSessions().then((sessions) => sessions.some((session) => session.runtimeMetadata.languageId === 'r'));
		if (!hasR) {
			vscode.window.showWarningMessage(
				vscode.l10n.t('No active R console session available. Please start one.')
			);
			return;
		}

		await refreshPackages(webviewProvider);
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
				value: webviewProvider.getFilter(),
				placeHolder: vscode.l10n.t('e.g. plot'),
			});

			webviewProvider.setFilter(input ?? '');

		}),

		// install packages
		vscode.commands.registerCommand('positron-r-package-manager.installPackages', () => {
			installPackages();
		}),
		// uninstall packages
		vscode.commands.registerCommand('positron-r-package-manager.uninstallPackage', (item: any) => {
			uninstallPackage(item, webviewProvider);
		}),

		// update packages
		vscode.commands.registerCommand('positron-r-package-manager.updatePackages', () => {
			updatePackages(webviewProvider);
		}),

		vscode.commands.registerCommand('positron-r-package-manager.filterLoadedPackages', () => {
			webviewProvider.toggleShowOnlyLoadedPackages();
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }