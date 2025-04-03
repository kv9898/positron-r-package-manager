import * as vscode from 'vscode';

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
}

class RPackageItem extends vscode.TreeItem {
    constructor(pkg: RPackageInfo) {
        super(pkg.name, vscode.TreeItemCollapsibleState.None);

        this.description = pkg.version;
        this.tooltip = `${pkg.name} - ${pkg.version}`;
        this.contextValue = 'rPackage';

        // Checkbox indicator (VS Code 1.66+ only)
        this.checkboxState = pkg.loaded
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;
    }
}

