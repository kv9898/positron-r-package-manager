import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { SidebarProvider, RPackageInfo } from '../sidebar';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('SidebarProvider refreshes packages correctly', () => {
		const sidebarProvider = new SidebarProvider();

		const packages: RPackageInfo[] = [
			{
				name: 'pkg1',
				version: '1.0',
				libpath: '/path/to/lib',
				locationtype: 'System',
				title: 'Package 1',
				loaded: false
			},
			{
				name: 'pkg2',
				version: '2.15.3',
				libpath: '/path/to/lib',
				locationtype: 'System',
				title: 'Package 2',
				loaded: false
			},
			{
				name: 'pkg3',
				version: '0.1',
				libpath: '/path/to/lib',
				locationtype: 'User',
				title: 'Package 3',
				loaded: true
			}
		];

		sidebarProvider.refresh(packages);

		// Verify packages are stored correctly
		assert.strictEqual(sidebarProvider.getPackages().length, 3);
		assert.strictEqual(sidebarProvider.getPackages()[0].name, 'pkg1');
		assert.strictEqual(sidebarProvider.getPackages()[1].version, '2.15.3');
		assert.strictEqual(sidebarProvider.getPackages()[2].loaded, true);
	});

	test('SidebarProvider handles empty packages array', () => {
		const sidebarProvider = new SidebarProvider();

		const packages: RPackageInfo[] = [];
		sidebarProvider.refresh(packages);

		// Should handle empty array gracefully
		assert.strictEqual(sidebarProvider.getPackages().length, 0);
	});
});
