import { beforeEach, describe, expect, it } from 'vitest';
import {
	createDeviceStore,
	memoryStorage,
	type DeviceStore,
	type StorageLike
} from '#lib/workspace/device-store.ts';
import {
	forgetRecent,
	normalizeInitials,
	readInitials,
	readLinked,
	readRecents,
	rememberLinked,
	rememberRecent,
	saveInitials
} from '#lib/workspace/recents.ts';
import { saveShared } from '#lib/workspace/save-shared.ts';
import { sharePayload } from '#lib/workspace/share.ts';
import type { Plan } from '#lib/workspace/schemas.ts';

let storage: StorageLike;
let device: DeviceStore;
let time = 1_700_000_000_000;

const plan: Plan = {
	id: 'plan1',
	name: 'Q26 plan',
	notes: '',
	updatedAt: 1,
	shapes: [{ id: 's1', kind: 'robot', color: 'blue', x: 60, y: 420, label: '14624' }]
};

beforeEach(() => {
	storage = memoryStorage();
	device = createDeviceStore(storage, { now: () => time });
});

describe('recent workspaces', () => {
	const recent = (code: string, openedAt = 1) => ({
		code,
		teamNumber: 14624,
		kind: 'device' as const,
		openedAt
	});

	it('starts empty and remembers the newest first', () => {
		expect(readRecents(storage)).toEqual([]);
		rememberRecent(storage, recent('AAAAAA', 1));
		rememberRecent(storage, recent('BBBBBB', 2));
		expect(readRecents(storage).map((item) => item.code)).toEqual(['BBBBBB', 'AAAAAA']);
	});

	it('moves a workspace to the front when it is opened again', () => {
		rememberRecent(storage, recent('AAAAAA', 1));
		rememberRecent(storage, recent('BBBBBB', 2));
		rememberRecent(storage, recent('AAAAAA', 3));
		expect(readRecents(storage).map((item) => item.code)).toEqual(['AAAAAA', 'BBBBBB']);
	});

	it('keeps at most eight', () => {
		for (const code of ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD', 'EEEEEE', 'FFFFFF', 'GGGGGG']) {
			rememberRecent(storage, recent(code));
		}
		for (const code of ['HHHHHH', 'JJJJJJ', 'KKKKKK']) rememberRecent(storage, recent(code));
		expect(readRecents(storage)).toHaveLength(8);
	});

	it('forgets one', () => {
		rememberRecent(storage, recent('AAAAAA'));
		rememberRecent(storage, recent('BBBBBB'));
		expect(forgetRecent(storage, 'AAAAAA').map((item) => item.code)).toEqual(['BBBBBB']);
	});

	it('ignores entries that are not valid', () => {
		storage.setItem(
			'ps-workspaces',
			JSON.stringify([
				recent('AAAAAA'),
				{ code: 'nope' },
				5,
				null,
				{ ...recent('BBBBBB'), kind: 'x' }
			])
		);
		expect(readRecents(storage).map((item) => item.code)).toEqual(['AAAAAA']);
		storage.setItem('ps-workspaces', '{broken');
		expect(readRecents(storage)).toEqual([]);
	});
});

describe('initials', () => {
	it('keeps up to three letters or digits in capitals', () => {
		expect(normalizeInitials(' a.l ')).toBe('AL');
		expect(normalizeInitials('abcd')).toBe('ABC');
		expect(normalizeInitials('!!')).toBe('');
	});

	it('saves once per device and can be cleared', () => {
		expect(readInitials(storage)).toBe('');
		expect(saveInitials(storage, 'al')).toBe('AL');
		expect(readInitials(storage)).toBe('AL');
		expect(saveInitials(storage, '')).toBe('');
		expect(readInitials(storage)).toBe('');
	});
});

describe('saving a shared link to this device', () => {
	it('makes a workspace holding the shared plan', async () => {
		const payload = sharePayload('board', plan, { from: 'ABCD3F', team: 14624, now: time });
		const saved = await saveShared(payload, device, storage, () => time);
		expect(saved.tool).toBe('board');
		const snapshot = await device.load(saved.code);
		expect(snapshot?.meta.teamNumber).toBe(14624);
		expect(snapshot?.docs.boards?.data.plans).toEqual([plan]);
		expect(readRecents(storage)[0]).toMatchObject({ code: saved.code, kind: 'device' });
		expect(readLinked(storage, 'ABCD3F')).toBe(saved.code);
	});

	it('updates the saved copy when the same workspace shares again', async () => {
		const first = await saveShared(
			sharePayload('board', plan, { from: 'ABCD3F', team: 14624 }),
			device,
			storage
		);
		const second = await saveShared(
			sharePayload('board', { ...plan, name: 'Q26 plan, new' }, { from: 'ABCD3F', team: 14624 }),
			device,
			storage
		);
		expect(second.code).toBe(first.code);
		const plans = (await device.load(first.code))?.docs.boards?.data.plans;
		expect(plans).toHaveLength(1);
		expect(plans?.[0].name).toBe('Q26 plan, new');
	});

	it('adds another plan next to the ones already saved', async () => {
		const first = await saveShared(
			sharePayload('board', plan, { from: 'ABCD3F', team: null }),
			device,
			storage
		);
		await saveShared(
			sharePayload(
				'board',
				{ ...plan, id: 'plan2', name: 'Q31 plan' },
				{ from: 'ABCD3F', team: null }
			),
			device,
			storage
		);
		const plans = (await device.load(first.code))?.docs.boards?.data.plans;
		expect(plans?.map((item) => item.name)).toEqual(['Q26 plan', 'Q31 plan']);
	});

	it('makes a new workspace for a link from an unknown sender', async () => {
		const a = await saveShared(
			sharePayload('board', plan, { from: null, team: null }),
			device,
			storage
		);
		const b = await saveShared(
			sharePayload('board', plan, { from: null, team: null }),
			device,
			storage
		);
		expect(a.code).not.toBe(b.code);
	});

	it('saves the other tools as whole documents', async () => {
		const list = await saveShared(
			sharePayload(
				'picklist',
				{ event: 'USAZGIQ', entries: [{ team: 2844, name: null, note: '', taken: false }] },
				{ from: 'ABCD3F', team: 14624 }
			),
			device,
			storage
		);
		const snapshot = await device.load(list.code);
		expect(snapshot?.docs.picklist?.data.entries[0].team).toBe(2844);

		const checks = await saveShared(
			sharePayload(
				'checklist',
				{ match: 'Q26', items: [{ id: 'a', text: 'Battery in', by: 'AL', at: 5 }], history: [] },
				{ from: 'ABCD3F', team: 14624 }
			),
			device,
			storage
		);
		expect(checks.code).toBe(list.code);
		expect((await device.load(list.code))?.docs.checklist?.data.match).toBe('Q26');

		await saveShared(
			sharePayload(
				'batteries',
				{
					items: [
						{
							id: 'b',
							name: 'B1',
							status: 'charged',
							voltage: 13,
							used: [],
							note: '',
							restedSince: null
						}
					]
				},
				{ from: 'ABCD3F', team: 14624 }
			),
			device,
			storage
		);
		expect((await device.load(list.code))?.docs.batteries?.data.items[0].name).toBe('B1');
	});

	it('remembers which workspace a link came from', () => {
		expect(readLinked(storage, 'ABCD3F')).toBeNull();
		rememberLinked(storage, 'ABCD3F', 'GGGGGG');
		rememberLinked(storage, 'EEEEEE', 'HHHHHH');
		expect(readLinked(storage, 'ABCD3F')).toBe('GGGGGG');
		expect(readLinked(storage, 'EEEEEE')).toBe('HHHHHH');
	});
});
