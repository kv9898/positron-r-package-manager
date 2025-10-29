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

	test('SidebarProvider calculates max version length correctly', () => {
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
		
		// The longest version is '2.15.3' with length 6
		assert.strictEqual(sidebarProvider.getMaxVersionLength(), 6);
	});

	test('Version padding creates consistent length strings', () => {
		const versions = ['1.0', '2.15.3', '0.1', '1.2-15'];
		const maxLength = Math.max(...versions.map(v => v.length));
		
		const paddedVersions = versions.map(v => v.padEnd(maxLength, ' '));
		
		// All padded versions should have the same length
		paddedVersions.forEach(pv => {
			assert.strictEqual(pv.length, maxLength);
		});
		
		// Verify padding doesn't modify content (only adds spaces)
		versions.forEach((v, i) => {
			assert.strictEqual(paddedVersions[i].trimEnd(), v);
		});
	});
});
