import { describe, expect, it } from 'vitest';
import {
	decodeShare,
	encodeShare,
	MAX_TOKEN_LENGTH,
	sharePayload,
	shareUrl
} from '#lib/workspace/share.ts';
import type { Plan, SharePayload } from '#lib/workspace/schemas.ts';

const plan: Plan = {
	id: 'plan1',
	name: 'Q26 plan',
	notes: '14624 takes the left side.',
	updatedAt: 1_700_000_000_000,
	shapes: [
		{ id: 's1', kind: 'pen', color: 'green', dash: false, pts: [74, 404, 110, 340, 150, 300] },
		{ id: 's2', kind: 'arrow', color: 'ink', dash: true, pts: [124, 146, 196, 212] },
		{ id: 's3', kind: 'robot', color: 'blue', x: 60, y: 420, label: '14624' },
		{ id: 's4', kind: 'text', color: 'red', x: 200, y: 288, text: 'Hive frame' }
	]
};

const context = { from: 'ABCD3F', team: 14624, now: 1_700_000_001_000 };

describe('share links', () => {
	it('round trips a strategy plan', async () => {
		const payload = sharePayload('board', plan, context);
		const token = await encodeShare(payload);
		expect(await decodeShare(token)).toEqual(payload);
	});

	it('round trips every tool', async () => {
		const payloads: SharePayload[] = [
			sharePayload(
				'picklist',
				{
					event: 'USAZGIQ',
					entries: [{ team: 2844, name: 'Valley X Robotics', note: 'Strong auto', taken: false }]
				},
				context
			),
			sharePayload(
				'batteries',
				{
					items: [
						{
							id: 'b1',
							name: 'B1',
							status: 'charged',
							voltage: 13.1,
							used: ['Q5'],
							note: '',
							restedSince: 1_700_000_000_000
						}
					]
				},
				context
			),
			sharePayload(
				'checklist',
				{
					match: 'Q26',
					items: [{ id: 'c1', text: 'Battery in', by: 'AL', at: 1_700_000_000_000 }],
					history: []
				},
				context
			)
		];
		for (const payload of payloads) {
			expect(await decodeShare(await encodeShare(payload))).toEqual(payload);
		}
	});

	it('only uses url safe characters', async () => {
		const token = await encodeShare(sharePayload('board', plan, context));
		expect(token).toMatch(/^[zp][A-Za-z0-9_-]+$/);
	});

	it('compresses repetitive plans', async () => {
		const busy: Plan = {
			...plan,
			shapes: Array.from({ length: 60 }, (_, index) => ({
				id: `pen${index}`,
				kind: 'pen' as const,
				color: 'ink' as const,
				dash: false,
				pts: Array.from({ length: 40 }, (_, point) => 100 + point + (index % 7))
			}))
		};
		const payload = sharePayload('board', busy, context);
		const token = await encodeShare(payload);
		expect(token[0]).toBe('z');
		expect(token.length).toBeLessThan(JSON.stringify(payload).length / 2);
		expect(await decodeShare(token)).toEqual(payload);
	});

	it('accepts the token with a leading hash', async () => {
		const payload = sharePayload('board', plan, context);
		expect(await decodeShare(`#${await encodeShare(payload)}`)).toEqual(payload);
	});

	it('builds a link that names the tool', async () => {
		const token = await encodeShare(sharePayload('board', plan, context));
		expect(shareUrl('https://ftcpitstop.com', 'board', token)).toBe(
			`https://ftcpitstop.com/w/share/board#${token}`
		);
	});

	it('rejects damaged tokens', async () => {
		const token = await encodeShare(sharePayload('board', plan, context));
		expect(await decodeShare('')).toBeNull();
		expect(await decodeShare('z')).toBeNull();
		expect(await decodeShare('x' + token.slice(1))).toBeNull();
		expect(await decodeShare(token.slice(0, 20))).toBeNull();
		expect(await decodeShare(`${token}!!`)).toBeNull();
		expect(await decodeShare('zAAAAAAAAAAAAAAAA')).toBeNull();
		expect(await decodeShare('p' + btoa('not json'))).toBeNull();
	});

	it('rejects payloads that fail validation', async () => {
		const bad = { ...sharePayload('board', plan, context), data: { id: 'x', shapes: 'no' } };
		const token = await encodeShare(bad as unknown as SharePayload);
		expect(await decodeShare(token)).toBeNull();
	});

	it('rejects tokens that are too long', async () => {
		expect(await decodeShare(`p${'A'.repeat(MAX_TOKEN_LENGTH)}`)).toBeNull();
	});

	it('refuses a compressed bomb', async () => {
		const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
			start(controller) {
				controller.enqueue(new Uint8Array(2_000_000).fill(65));
				controller.close();
			}
		});
		const stream = source.pipeThrough(new CompressionStream('deflate-raw'));
		const packed = new Uint8Array(await new Response(stream).arrayBuffer());
		let binary = '';
		for (const byte of packed) binary += String.fromCharCode(byte);
		const token = `z${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
		expect(await decodeShare(token)).toBeNull();
	});
});
