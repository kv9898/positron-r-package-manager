import * as vscode from 'vscode';
import * as positron from 'positron';
import { refreshPackages } from './refresh';

export interface RPackageInfo {
    name: string;
    version: string;
    loaded: boolean;
}

export class SidebarProvider implements vscode.TreeDataProvider<RPackageItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RPackageItem | undefined | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<RPackageItem | undefined | void> = this._onDidChangeTreeData.event;

    private packages: RPackageInfo[] = [];

    refresh(packages: RPackageInfo[]): void {
        this.packages = packages;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RPackageItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<RPackageItem[]> {
        const items = this.packages.map(pkg => new RPackageItem(pkg));
        return Promise.resolve(items);
    }
    handleCheckboxChange(item: RPackageItem, newState: vscode.TreeItemCheckboxState) {
        const isNowChecked = newState === vscode.TreeItemCheckboxState.Checked;

        const code = isNowChecked
            ? `library(${item.pkg.name})`
            : `detach("package:${item.pkg.name}", unload = TRUE)`;

        positron.runtime.executeCode('r', code, true, undefined, positron.RuntimeCodeExecutionMode.Interactive)
            .then(() => {

                // Reload full package list
                refreshPackages(this);
            });
    }
}

export class RPackageItem extends vscode.TreeItem {
    constructor(public pkg: RPackageInfo) {
        super(pkg.name, vscode.TreeItemCollapsibleState.None);

        this.description = pkg.version;
        this.tooltip = `Click to view help for ${pkg.name}`;
        this.contextValue = 'rPackage';

        this.checkboxState = pkg.loaded
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;

        this.command = {
            command: 'positron-r-package-manager.openHelp',
            title: 'Open Package Help',
            arguments: [pkg.name],
        };
    }
}

