import * as vscode from 'vscode';
import { getPositron } from './positronApi';
import * as path from 'path';
import { filter } from 'fuzzaldrin-plus';
import { RPackageInfo } from './sidebar';

/**
 * Provides a webview-based view for R package management with proper column alignment
 */
export class RPackageWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'rPackageView';

    private _view?: vscode.WebviewView;
    private packages: RPackageInfo[] = [];
    private filterText: string = '';
    private showOnlyLoadedPackages: boolean = false;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'loadPackage':
                    await this.loadPackage(data.packageName, data.libpath);
                    break;
                case 'unloadPackage':
                    await this.unloadPackage(data.packageName);
                    break;
                case 'uninstallPackage':
                    await this.uninstallPackage(data.packageName, data.libpath);
                    break;
                case 'openHelp':
                    await this.openHelp(data.packageName);
                    break;
            }
        });
    }

    /**
     * Refresh the package list with new data
     */
    public refresh(packages: RPackageInfo[]): void {
        this.packages = packages;
        this.updateWebview();
    }

    /**
     * Set the filter text for package search
     */
    public setFilter(filterText: string): void {
        this.filterText = filterText;
        this.updateWebview();
    }

    /**
     * Get the current filter text
     */
    public getFilter(): string {
        return this.filterText;
    }

    /**
     * Get the current package list
     */
    public getPackages(): RPackageInfo[] {
        return this.packages;
    }

    /**
     * Toggle showing only loaded packages
     */
    public toggleShowOnlyLoadedPackages(): void {
        this.showOnlyLoadedPackages = !this.showOnlyLoadedPackages;
        this.updateWebview();
    }

    /**
     * Update the webview content
     */
    private updateWebview(): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                packages: this.getFilteredPackages()
            });
        }
    }

    /**
     * Get filtered packages based on search and loaded filter
     */
    private getFilteredPackages(): RPackageInfo[] {
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

        if (this.showOnlyLoadedPackages) {
            filtered = filtered.filter(pkg => pkg.loaded);
        }

        return filtered;
    }

    /**
     * Load a package in the R session
     */
    private async loadPackage(packageName: string, libpath: string): Promise<void> {
        const positron = getPositron();
        const code = `library(${JSON.stringify(packageName)}, lib.loc = ${JSON.stringify(libpath)})`;
        await positron.runtime.executeCode('r', code, true, undefined, positron.RuntimeCodeExecutionMode.Interactive);
    }

    /**
     * Unload a package from the R session
     */
    private async unloadPackage(packageName: string): Promise<void> {
        const positron = getPositron();
        const code = `detach("package:${packageName}", unload = TRUE)`;
        await positron.runtime.executeCode('r', code, true, undefined, positron.RuntimeCodeExecutionMode.Interactive);
    }

    /**
     * Uninstall a package
     */
    private async uninstallPackage(packageName: string, libpath: string): Promise<void> {
        // Trigger the uninstall command
        await vscode.commands.executeCommand('positron-r-package-manager.uninstallPackage', {
            pkg: this.packages.find(p => p.name === packageName && p.libpath === libpath)
        });
    }

    /**
     * Open package help
     */
    private async openHelp(packageName: string): Promise<void> {
        await vscode.commands.executeCommand('positron-r-package-manager.openHelp', packageName);
    }

    /**
     * Generate the HTML content for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the CSS and styling
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'webview.css'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>R Packages</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
        }

        #package-list {
            width: 100%;
        }

        .package-row {
            display: grid;
            grid-template-columns: 24px 1fr 80px 100px 24px;
            gap: 8px;
            padding: 4px 8px;
            align-items: center;
            border-bottom: 1px solid var(--vscode-widget-border);
            cursor: pointer;
        }

        .package-row:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .package-row.loaded {
            font-weight: 600;
        }

        .checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .package-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .package-version {
            text-align: right;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
            font-size: 0.95em;
        }

        .package-location {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .uninstall-btn {
            opacity: 0;
            width: 20px;
            height: 20px;
            background: none;
            border: none;
            cursor: pointer;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s;
        }

        .package-row:hover .uninstall-btn {
            opacity: 1;
        }

        .uninstall-btn:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        .empty-message {
            padding: 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }

        /* Header row */
        .header-row {
            display: grid;
            grid-template-columns: 24px 1fr 80px 100px 24px;
            gap: 8px;
            padding: 4px 8px;
            font-weight: 600;
            border-bottom: 2px solid var(--vscode-widget-border);
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }

        .header-row > div:nth-child(3),
        .header-row > div:nth-child(4) {
            text-align: right;
        }
    </style>
</head>
<body>
    <div id="package-list">
        <div class="empty-message">Loading packages...</div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'update':
                    renderPackages(message.packages);
                    break;
            }
        });

        function renderPackages(packages) {
            const container = document.getElementById('package-list');
            
            if (!packages || packages.length === 0) {
                container.innerHTML = \`
                    <div class="empty-message">
                        <div>No R package information available yet.</div>
                        <div style="margin-top: 8px; font-size: 0.9em;">Try to refresh after R starts or clear search.</div>
                    </div>
                \`;
                return;
            }

            let html = \`
                <div class="header-row">
                    <div></div>
                    <div>Name</div>
                    <div>Version</div>
                    <div>Location</div>
                    <div></div>
                </div>
            \`;

            packages.forEach(pkg => {
                const locationBadge = getLocationBadge(pkg.locationtype);
                const checkboxState = pkg.loaded ? 'checked' : '';
                const loadedClass = pkg.loaded ? 'loaded' : '';
                
                html += \`
                    <div class="package-row \${loadedClass}" 
                         data-package-name="\${pkg.name}"
                         data-libpath="\${pkg.libpath}"
                         data-loaded="\${pkg.loaded}"
                         title="\${pkg.title || pkg.name}">
                        <input type="checkbox" 
                               class="checkbox" 
                               \${checkboxState}
                               onclick="togglePackage(event, '\${pkg.name}', '\${pkg.libpath}', \${pkg.loaded})">
                        <div class="package-name" onclick="openHelp('\${pkg.name}')">\${pkg.name}</div>
                        <div class="package-version">\${pkg.version}</div>
                        <div class="package-location">\${locationBadge}</div>
                        <button class="uninstall-btn" 
                                onclick="uninstall(event, '\${pkg.name}', '\${pkg.libpath}')"
                                title="Uninstall">×</button>
                    </div>
                \`;
            });

            container.innerHTML = html;
        }

        function getLocationBadge(locationType) {
            const type = locationType.toLowerCase();
            if (type.includes('renv')) {
                return 'renv';
            } else if (type.includes('global') || type.includes('system')) {
                return 'System';
            } else if (type.includes('user')) {
                return 'User';
            } else if (type.includes('dev') || type.includes('development')) {
                return 'Dev';
            }
            return locationType;
        }

        function togglePackage(event, packageName, libpath, isLoaded) {
            event.stopPropagation();
            if (isLoaded) {
                vscode.postMessage({
                    type: 'unloadPackage',
                    packageName: packageName
                });
            } else {
                vscode.postMessage({
                    type: 'loadPackage',
                    packageName: packageName,
                    libpath: libpath
                });
            }
        }

        function uninstall(event, packageName, libpath) {
            event.stopPropagation();
            vscode.postMessage({
                type: 'uninstallPackage',
                packageName: packageName,
                libpath: libpath
            });
        }

        function openHelp(packageName) {
            vscode.postMessage({
                type: 'openHelp',
                packageName: packageName
            });
        }
    </script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
