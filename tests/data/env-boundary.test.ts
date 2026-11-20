import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(ROOT, 'src');

function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|js|svelte)$/.test(entry.name) ? [path] : [];
	});
}

function importing(pattern: RegExp): string[] {
	return sources(SRC)
		.filter((path) => pattern.test(readFileSync(path, 'utf8')))
		.map((path) => relative(ROOT, path));
}

describe('private environment variables', () => {
	it('are never declared public', () => {
		const declaration = readFileSync(join(SRC, 'env.ts'), 'utf8');
		expect(declaration).not.toMatch(/public\s*:\s*true/);
		expect(declaration).not.toMatch(/static\s*:\s*true/);
	});

	it('are only read by modules under src/lib/server', () => {
		const readers = importing(/\$app\/env\/private|\$env\/|process\.env|import\.meta\.env/);
		expect(readers.length).toBeGreaterThan(0);
		for (const path of readers) expect(path.startsWith('src/lib/server/')).toBe(true);
	});

	it('are not read by anything that ships to the browser', () => {
		const shipped = sources(SRC).filter(
			(path) =>
				path.endsWith('.svelte') ||
				path.endsWith('service-worker.ts') ||
				/src\/lib\/(?!server\/)/.test(path)
		);
		for (const path of shipped) {
			const code = readFileSync(path, 'utf8');
			expect(code, relative(ROOT, path)).not.toMatch(/FTC_API_KEY|KV_REST_API_TOKEN|NEXUS_API_KEY/);
		}
	});
});
