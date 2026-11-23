import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export const OUTPUT = join(import.meta.dirname, '../.svelte-kit/output');

const SHARED_LAYOUTS = ['pages/_layout.svelte.js', 'pages/(app)/_layout.svelte.js'];

interface NodeAssets {
	component: string;
	imports: string[];
	stylesheets: string[];
}

function list(source: string, name: string): string[] {
	const match = new RegExp(`\\b${name}\\s*[:=]\\s*(\\[[^\\]]*\\])`).exec(source);
	return match ? JSON.parse(match[1]) : [];
}

function readNode(file: string): NodeAssets {
	const source = readFileSync(file, 'utf8');
	return {
		component: /import\('\.\.\/entries\/([^']+)'\)/.exec(source)?.[1] ?? '',
		imports: list(source, 'imports'),
		stylesheets: list(source, 'stylesheets')
	};
}

export function hasBuild(output = OUTPUT): boolean {
	return existsSync(join(output, 'server/manifest.js'));
}

export function sharedAssets(output = OUTPUT) {
	const manifest = readFileSync(join(output, 'server/manifest.js'), 'utf8');
	const client = /\bclient:\s*\{[^}]*\}/.exec(manifest)?.[0] ?? '';
	const nodesDir = join(output, 'server/nodes');
	const layouts = readdirSync(nodesDir)
		.map((file) => readNode(join(nodesDir, file)))
		.filter((node) => SHARED_LAYOUTS.includes(node.component));
	return {
		layouts: layouts.map((node) => node.component),
		js: [...new Set([...list(client, 'imports'), ...layouts.flatMap((node) => node.imports)])],
		css: [
			...new Set([...list(client, 'stylesheets'), ...layouts.flatMap((node) => node.stylesheets)])
		]
	};
}

function read(file: string, output: string): Buffer {
	return readFileSync(join(output, 'client', file));
}

export function gzipBytes(files: string[], output = OUTPUT): number {
	return files.reduce((total, file) => total + gzipSync(read(file, output)).length, 0);
}

export function readCode(files: string[], output = OUTPUT): string {
	return files.map((file) => read(file, output).toString('utf8')).join('\n');
}
