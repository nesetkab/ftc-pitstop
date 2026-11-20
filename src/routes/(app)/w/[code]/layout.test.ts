import { describe, expect, it } from 'vitest';
import { load } from './+layout.ts';

function run(code: string, path: string, rest = '') {
	return load({ params: { code }, url: new URL(`http://localhost${path}${rest}`) } as never);
}

describe('workspace layout', () => {
	it('passes a clean code on', () => {
		expect(run('ABCD3F', '/w/ABCD3F/picklist')).toEqual({ code: 'ABCD3F' });
	});

	it('redirects a typed code to its clean form and keeps the page, query and hash', () => {
		expect(() => run('abcd-3f', '/w/abcd-3f/board', '?x=1#top')).toThrowError(
			expect.objectContaining({ status: 307, location: '/w/ABCD3F/board?x=1#top' })
		);
	});

	it('only rewrites the code segment of the path', () => {
		expect(() => run('abcd3f', '/w/abcd3f/abcd3f')).toThrowError(
			expect.objectContaining({ location: '/w/ABCD3F/abcd3f' })
		);
	});

	it.each(['abc', '!!!!!!', 'ABCDE0', '//evil.example', '../x'])('answers 404 for %j', (code) => {
		expect(() => run(code, `/w/${encodeURIComponent(code)}/picklist`)).toThrowError(
			expect.objectContaining({ status: 404 })
		);
	});
});
