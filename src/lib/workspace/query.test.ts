import { describe, expect, it } from 'vitest';
import { encodeLoadOptions, parseLoadOptions } from '#lib/workspace/query.ts';

const parse = (query: string) => parseLoadOptions(new URLSearchParams(query));

describe('load options', () => {
	it('round trip through the address', () => {
		const options = {
			known: { picklist: 1_700_000_000_123, boards: 5 },
			docs: ['picklist'] as const
		};
		expect(parse(encodeLoadOptions(options))).toEqual({
			known: options.known,
			docs: ['picklist']
		});
		expect(encodeLoadOptions({})).toBe('');
	});

	it('read no versions when the parameter is missing, and an empty list when it is empty', () => {
		expect(parse('')).toEqual({ known: undefined, docs: undefined });
		expect(parse('known=')).toEqual({ known: {}, docs: undefined });
	});

	it('ignore documents and versions that make no sense', () => {
		expect(
			parse('known=secrets.1,picklist.x,picklist.,boards.,batteries.-1,checklist.7').known
		).toEqual({ checklist: 7 });
		expect(parse(`known=picklist.${'9'.repeat(17)}`).known).toEqual({});
		expect(parse('known=__proto__.1,constructor.1').known).toEqual({});
		expect(Object.getPrototypeOf(parse('known=__proto__.1').known)).toBe(Object.prototype);
	});

	it('ask for each document once, however often it is named', () => {
		const docs = ['picklist', 'boards', 'nope', 'picklist', 'boards', 'picklist'].join(',');
		expect(parse(`docs=${docs}`).docs).toEqual(['picklist', 'boards']);
		const flood = Array.from({ length: 1500 }, () => 'boards').join(',');
		expect(parse(`docs=${flood}`).docs).toEqual(['boards']);
		expect(parse('docs=nope,,').docs).toBeUndefined();
	});

	it('carry the workspace version and drop one that looks wrong', () => {
		const rev = '0123456789abcdef0123456789abcdef';
		expect(parse(encodeLoadOptions({ rev })).rev).toBe(rev);
		expect(parse('rev=short').rev).toBeUndefined();
		expect(parse(`rev=${'a'.repeat(41)}`).rev).toBeUndefined();
		expect(parse('rev=ABC*DEF1234').rev).toBeUndefined();
	});
});
