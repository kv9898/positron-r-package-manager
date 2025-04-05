import * as vscode from 'vscode';
import * as positron from 'positron';
import { refreshPackages } from './refresh';

export interface RPackageInfo {
    name: string;
    version: string;
    libpath: string;
    locationtype: string;
    title: string;
    loaded: boolean;
}

export class SidebarProvider implements vscode.TreeDataProvider<RPackageItem> {
    private filterText: string = '';
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
        let filtered = this.packages;

        if (this.filterText.trim()) {
            const keyword = this.filterText.toLowerCase();
            filtered = this.packages.filter(pkg =>
                pkg.name.toLowerCase().includes(keyword) ||
                pkg.title.toLowerCase().includes(keyword)
            );
        }

        if (filtered.length === 0) {
            return Promise.resolve([
                new PlaceholderItem("No R package information available yet.") as RPackageItem,
                new PlaceholderItem("Try to refresh after R starts or clear search.") as RPackageItem
            ]);
        }

        return Promise.resolve(filtered.map(pkg => new RPackageItem(pkg)));
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

    getFilter(): string {
        return this.filterText || '';
    }
    setFilter(filterText: string) {
        this.filterText = filterText;
        refreshPackages(this); // re-render the tree
    }

    getPackages(): RPackageInfo[] {
        return this.packages;
    }
}

export class RPackageItem extends vscode.TreeItem {
    constructor(public pkg: RPackageInfo) {
        super(pkg.name, vscode.TreeItemCollapsibleState.None);

        this.description = `${pkg.version} (${pkg.locationtype})`;
        this.tooltip = `${pkg.title}\n(${pkg.libpath})`;

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

/**
 * A placeholder TreeItem displayed in the R Packages sidebar
 * when no package information is currently available.
 *
 * This is typically shown when the R runtime has not been started
 * or the extension has not yet fetched package data.
 *
 * Displays an informative message with an info icon,
 * and disables interactions like collapsibility and checkboxes.
 */
class PlaceholderItem extends vscode.TreeItem {
    constructor(message: string) {
        super(message, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'placeholder';
    }
}
