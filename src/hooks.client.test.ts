import { expect, it, vi } from 'vitest';

it('keeps the browser from compiling validators with eval', async () => {
	await import('./hooks.client.ts');
	const compile = vi.fn(function () {
		throw new Error('Refused to evaluate a string as JavaScript');
	});
	vi.stubGlobal('Function', compile);
	const { emptyDocs, parseDoc } = await import('#lib/workspace/schemas.ts');
	expect(parseDoc('picklist', emptyDocs().picklist)).toEqual({ event: null, entries: [] });
	expect(parseDoc('picklist', { entries: 'no' })).toBeNull();
	expect(compile).not.toHaveBeenCalled();
	vi.unstubAllGlobals();
});
