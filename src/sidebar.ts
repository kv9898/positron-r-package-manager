import * as vscode from 'vscode';
import * as positron from 'positron';
import { filter } from 'fuzzaldrin-plus';
import { refreshPackages } from './refresh';
import * as path from 'path'; 

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

    /**
     * Refresh the package list with the given data. This function is meant to be called from the refreshPackages function in the refresh module.
     * @param packages A list of RPackageInfo objects, which will be used to populate the tree view.
     */
    refresh(packages: RPackageInfo[]): void {
        this.packages = packages;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Returns the TreeItem for the given RPackageItem.
     * @param element The RPackageItem to generate a TreeItem for.
     * @returns The TreeItem corresponding to the given RPackageItem.
     */
    getTreeItem(element: RPackageItem): vscode.TreeItem {
        return element;
    }

    /**
     * Returns the children elements of the tree view.
     *
     * If the package list is empty, it returns two placeholder items to indicate that the package information is not available and that the user should try to refresh after R starts or clear the search.
     *
     * If the package list is filtered, it returns a filtered list of RPackageItems.
     *
     * Otherwise, it returns the list of RPackageItems.
     * @returns A list of RPackageItems, which are the children of the tree view.
     */
    getChildren(): Thenable<RPackageItem[]> {
        let filtered = this.packages;

        if (this.filterText.trim()) {
            const enriched = this.packages.map(pkg => ({
                pkg,
                query: `${pkg.name} ${pkg.title}`
            }));

            const matches = filter(enriched, this.filterText.trim(), {
                key: 'query'
            });

            filtered = matches.map(m => m.pkg);
        }

        if (filtered.length === 0) {
            return Promise.resolve([
                new PlaceholderItem(vscode.l10n.t("No R package information available yet.")) as RPackageItem,
                new PlaceholderItem(vscode.l10n.t("Try to refresh after R starts or clear search.")) as RPackageItem
            ]);
        }

        return Promise.resolve(filtered.map(pkg => new RPackageItem(pkg)));
    }

    /**
     * Handles a change in the checkbox state of an RPackageItem in the tree view.
     * If the item is now checked, it will load the package in the current R session.
     * If the item is now unchecked, it will unload the package from the current R session.
     * @param item The RPackageItem whose checkbox state has changed.
     * @param newState The new state of the checkbox.
     */
    handleCheckboxChange(item: RPackageItem, newState: vscode.TreeItemCheckboxState) {
        const isNowChecked = newState === vscode.TreeItemCheckboxState.Checked;

        const code = isNowChecked
            ? `library(${JSON.stringify(item.pkg.name)}, lib.loc = ${JSON.stringify(item.pkg.libpath)})`
            : `detach("package:${item.pkg.name}", unload = TRUE)`;

        positron.runtime.executeCode('r', code, true, undefined, positron.RuntimeCodeExecutionMode.Interactive)
            .then(() => {

                // Reload full package list
                refreshPackages(this);
            });
    }

    /**
     * Gets the current filter text.
     *
     * Returns an empty string if there is no filter text.
     * @returns The current filter text, or an empty string if there is no filter.
     */
    getFilter(): string {
        return this.filterText || '';
    }

    /**
     * Sets the filter text for the tree view and refreshes the tree view accordingly.
     * If the filter text is empty, the tree view will show all packages.
     * @param filterText The new filter text to apply to the tree view.
     */
    setFilter(filterText: string) {
        this.filterText = filterText;
        refreshPackages(this); // re-render the tree
    }

    /**
     * Gets the current list of packages as an array of RPackageInfo objects.
     * @returns The current list of packages.
     */
    getPackages(): RPackageInfo[] {
        return this.packages;
    }
}

export class RPackageItem extends vscode.TreeItem {
    /**
     * Creates a new RPackageItem representing an R package in the Positron tree view.
     * @param pkg The RPackageInfo object describing the package.
     */
    constructor(public pkg: RPackageInfo) {
        super(pkg.name, vscode.TreeItemCollapsibleState.None);

        this.description = `${pkg.version} (${pkg.locationtype})`;
        this.tooltip = `${pkg.title}\n(${pkg.libpath})`;

        this.contextValue = 'rPackage';

        this.iconPath = {
            light: vscode.Uri.file(
                path.join(__dirname, '..', 'resources', 'r_logo.svg')
            ),
            dark: vscode.Uri.file(
                path.join(__dirname, '..', 'resources', 'r_logo.svg')
            ),
        };

        this.checkboxState = pkg.loaded
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;

        this.command = {
            command: 'positron-r-package-manager.openHelp',
            title: vscode.l10n.t('Open Package Help'),
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
