import { expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ browser: true }));

it('keeps the browser from compiling validators with eval', async () => {
	const compile = vi.fn(function () {
		throw new Error('Refused to evaluate a string as JavaScript');
	});
	const { emptyDocs, parseDoc } = await import('#lib/workspace/schemas.ts');
	vi.stubGlobal('Function', compile);
	expect(parseDoc('picklist', emptyDocs().picklist)).toEqual({ event: null, entries: [] });
	expect(parseDoc('picklist', { entries: 'no' })).toBeNull();
	expect(compile).not.toHaveBeenCalled();
	vi.unstubAllGlobals();
});
