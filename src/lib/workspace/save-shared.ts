import { upsertPlan } from '#lib/workspace/board.ts';
import type { DeviceStore, StorageLike } from '#lib/workspace/device-store.ts';
import { readLinked, rememberLinked, rememberRecent } from '#lib/workspace/recents.ts';
import {
	emptyDoc,
	type SharePayload,
	type ShareTool,
	type Snapshot
} from '#lib/workspace/schemas.ts';

export interface Saved {
	code: string;
	tool: ShareTool;
}

export async function saveShared(
	payload: SharePayload,
	device: DeviceStore,
	storage: StorageLike,
	now: () => number = Date.now
): Promise<Saved> {
	const linked = payload.from ? readLinked(storage, payload.from) : null;
	let snapshot: Snapshot | null = linked ? await device.load(linked) : null;
	if (!snapshot) {
		const meta = await device.create({ teamNumber: payload.team });
		snapshot = { meta, docs: {} };
		if (payload.from) rememberLinked(storage, payload.from, meta.code);
	}
	const code = snapshot.meta.code;
	if (payload.tool === 'board') {
		const boards = snapshot.docs.boards?.data ?? emptyDoc('boards');
		await device.write(code, 'boards', upsertPlan(boards, payload.data));
	} else if (payload.tool === 'picklist') {
		await device.write(code, 'picklist', payload.data);
	} else if (payload.tool === 'batteries') {
		await device.write(code, 'batteries', payload.data);
	} else {
		await device.write(code, 'checklist', payload.data);
	}
	rememberRecent(storage, {
		code,
		teamNumber: snapshot.meta.teamNumber,
		kind: device.kind,
		openedAt: now()
	});
	return { code, tool: payload.tool };
}
