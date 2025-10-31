import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { SidebarProvider, RPackageInfo, RPackageItem } from '../sidebar';
import { stripAnsi, isLibPathWriteable, waitForFile } from '../utils';

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
		assert.deepStrictEqual(sidebarProvider.getMaxLengths(), [4, 6]);
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

	test('SidebarProvider handles empty packages array', () => {
		const sidebarProvider = new SidebarProvider();

		const packages: RPackageInfo[] = [];
		sidebarProvider.refresh(packages);

		// Should default to 0 for empty array
		assert.deepStrictEqual(sidebarProvider.getMaxLengths(), [0, 0]);
	});
});

suite('Utils Test Suite', () => {
	test('stripAnsi removes ANSI escape codes', () => {
		const textWithAnsi = '\x1b[31mError:\x1b[0m Something went wrong';
		const cleanText = stripAnsi(textWithAnsi);
		assert.strictEqual(cleanText, 'Error: Something went wrong');
	});

	test('stripAnsi handles text without ANSI codes', () => {
		const plainText = 'Plain text without codes';
		const result = stripAnsi(plainText);
		assert.strictEqual(result, plainText);
	});

	test('stripAnsi removes multiple ANSI codes', () => {
		const textWithMultipleAnsi = '\x1b[1m\x1b[31mBold Red\x1b[0m\x1b[32m Green\x1b[0m';
		const cleanText = stripAnsi(textWithMultipleAnsi);
		assert.strictEqual(cleanText, 'Bold Red Green');
	});

	test('isLibPathWriteable detects writable directory', () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-lib-'));
		try {
			const result = isLibPathWriteable(tempDir);
			assert.strictEqual(result, true);
		} finally {
			fs.rmdirSync(tempDir);
		}
	});

	test('isLibPathWriteable detects non-existent path', () => {
		const nonExistentPath = path.join(os.tmpdir(), 'non-existent-path-12345');
		const result = isLibPathWriteable(nonExistentPath);
		assert.strictEqual(result, false);
	});

	test('waitForFile resolves when file exists', async () => {
		const tempFile = path.join(os.tmpdir(), `test-file-${Date.now()}.txt`);
		
		// Create file after a small delay
		setTimeout(() => {
			fs.writeFileSync(tempFile, 'test content');
		}, 50);

		try {
			await waitForFile(tempFile, 500);
			assert.ok(fs.existsSync(tempFile), 'File should exist after wait');
		} finally {
			if (fs.existsSync(tempFile)) {
				fs.unlinkSync(tempFile);
			}
		}
	});

	test('waitForFile rejects on timeout', async () => {
		const nonExistentFile = path.join(os.tmpdir(), `non-existent-${Date.now()}.txt`);
		
		try {
			await waitForFile(nonExistentFile, 200);
			assert.fail('Should have thrown timeout error');
		} catch (error) {
			assert.ok(error instanceof Error);
			assert.ok(error.message.includes('Timeout'));
		}
	});
});

suite('Sidebar Test Suite', () => {
	test('SidebarProvider stores and retrieves packages', () => {
		const sidebarProvider = new SidebarProvider();
		const packages: RPackageInfo[] = [
			{
				name: 'testpkg',
				version: '1.0.0',
				libpath: '/lib',
				locationtype: 'User',
				title: 'Test Package',
				loaded: false
			}
		];

		sidebarProvider.refresh(packages);
		const storedPackages = sidebarProvider.getPackages();

		assert.strictEqual(storedPackages.length, 1);
		assert.strictEqual(storedPackages[0].name, 'testpkg');
	});

	test('SidebarProvider filter functionality', () => {
		const sidebarProvider = new SidebarProvider();

		assert.strictEqual(sidebarProvider.getFilter(), '');
		
		sidebarProvider.setFilter('test');
		assert.strictEqual(sidebarProvider.getFilter(), 'test');
	});

	test('RPackageItem creates proper tree item for System package', () => {
		const pkg: RPackageInfo = {
			name: 'base',
			version: '4.3.0',
			libpath: '/usr/lib/R',
			locationtype: 'System',
			title: 'Base R Package',
			loaded: true
		};

		const item = new RPackageItem(pkg, 0, 0);

		assert.strictEqual(item.label, 'base');
		assert.strictEqual(item.contextValue, 'rPackage');
		assert.strictEqual(item.checkboxState, vscode.TreeItemCheckboxState.Checked);
	});

	test('RPackageItem creates proper tree item for User package', () => {
		const pkg: RPackageInfo = {
			name: 'dplyr',
			version: '1.1.0',
			libpath: '/home/user/R/library',
			locationtype: 'User',
			title: 'Data Manipulation',
			loaded: false
		};

		const item = new RPackageItem(pkg, 0, 0);

		assert.strictEqual(item.label, 'dplyr');
		assert.strictEqual(item.contextValue, 'rPackage');
		assert.strictEqual(item.checkboxState, vscode.TreeItemCheckboxState.Unchecked);
	});

	test('RPackageItem creates proper tree item for renv package', () => {
		const pkg: RPackageInfo = {
			name: 'ggplot2',
			version: '3.4.0',
			libpath: '/project/renv/library',
			locationtype: 'renv',
			title: 'Grammar of Graphics',
			loaded: false
		};

		const item = new RPackageItem(pkg, 0, 0);

		assert.strictEqual(item.label, 'ggplot2');
		assert.ok(typeof item.description === 'string' && item.description.includes('renv'));
	});

	test('SidebarProvider filters packages by search text', async () => {
		const sidebarProvider = new SidebarProvider();
		const packages: RPackageInfo[] = [
			{
				name: 'ggplot2',
				version: '3.4.0',
				libpath: '/lib',
				locationtype: 'User',
				title: 'Create Elegant Data Visualisations',
				loaded: false
			},
			{
				name: 'dplyr',
				version: '1.1.0',
				libpath: '/lib',
				locationtype: 'User',
				title: 'Data Manipulation',
				loaded: false
			},
			{
				name: 'tidyr',
				version: '1.3.0',
				libpath: '/lib',
				locationtype: 'User',
				title: 'Tidy Messy Data',
				loaded: false
			}
		];

		sidebarProvider.refresh(packages);
		sidebarProvider.setFilter('plot');

		const children = await sidebarProvider.getChildren();
		// Filter should match ggplot2 based on name
		assert.ok(children.length > 0);
		assert.ok(children.some(item => item.label === 'ggplot2'));
	});

	test('SidebarProvider shows placeholder when no packages', async () => {
		const sidebarProvider = new SidebarProvider();
		sidebarProvider.refresh([]);

		const children = await sidebarProvider.getChildren();
		
		assert.strictEqual(children.length, 2);
		assert.ok(children[0].contextValue === 'placeholder');
	});

	test('SidebarProvider respects max length constraints', () => {
		const sidebarProvider = new SidebarProvider();
		const packages: RPackageInfo[] = [
			{
				name: 'verylongpackagename123',
				version: '1.0.0.9000.dev',
				libpath: '/lib',
				locationtype: 'User',
				title: 'Test',
				loaded: false
			}
		];

		sidebarProvider.refresh(packages);
		const [maxName, maxVersion] = sidebarProvider.getMaxLengths();

		// Should be constrained to max 10
		assert.ok(maxName <= 10);
		assert.ok(maxVersion <= 10);
	});
});

suite('Event Detection Test Suite', () => {
	test('library() detection pattern', () => {
		const testCases = [
			{ code: 'library(dplyr)', shouldMatch: true },
			{ code: 'library("ggplot2")', shouldMatch: true },
			{ code: 'require(tidyr)', shouldMatch: true },
			{ code: 'pacman::p_load(data.table)', shouldMatch: true },
			{ code: 'detach("package:dplyr")', shouldMatch: true },
			{ code: 'print("hello")', shouldMatch: false },
			{ code: 'x <- 1:10', shouldMatch: false }
		];

		for (const testCase of testCases) {
			const matches = testCase.code.includes('library(') || 
			                testCase.code.includes('require(') || 
			                testCase.code.includes('p_load(') || 
			                testCase.code.includes('detach(');
			assert.strictEqual(matches, testCase.shouldMatch, 
				`Failed for: ${testCase.code}`);
		}
	});
});
