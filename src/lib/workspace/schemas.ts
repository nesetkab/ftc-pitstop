import * as z from 'zod/mini';
import { browser } from '$app/env';
import { CODE_PATTERN } from '#lib/workspace/code.ts';

if (browser) z.config({ jitless: true });

export const DOC_NAMES = ['picklist', 'batteries', 'checklist', 'boards'] as const;

export type DocName = (typeof DOC_NAMES)[number];

export const BATTERY_STATUSES = ['charged', 'in-robot', 'charging', 'not-in-use'] as const;

export type BatteryStatus = (typeof BATTERY_STATUSES)[number];

export const SHAPE_COLORS = ['ink', 'red', 'blue', 'accent'] as const;

export type ShapeColor = (typeof SHAPE_COLORS)[number];

export const SHARE_TOOLS = ['picklist', 'batteries', 'checklist', 'board'] as const;

export type ShareTool = (typeof SHARE_TOOLS)[number];

export const LIMITS = {
	picks: 80,
	batteries: 40,
	checks: 60,
	history: 30,
	plans: 30,
	shapes: 400,
	penValues: 800
} as const;

const text = (max: number) => z.string().check(z.maxLength(max));
const range = (min: number, max: number) => z.number().check(z.minimum(min), z.maximum(max));
const whole = (min: number, max: number) => z.int().check(z.minimum(min), z.maximum(max));
const list = <T extends z.ZodMiniType>(item: T, max: number) =>
	z._default(z.array(item).check(z.maxLength(max)), []);
const nothing = <T extends z.ZodMiniType>(schema: T) => z._default(z.nullable(schema), null);
const id = z.string().check(z.minLength(1), z.maxLength(40));
const stamp = z.int().check(z.nonnegative());
const coordinate = range(-100, 600);
const color = z._default(z.enum(SHAPE_COLORS), 'ink');
const dash = z._default(z.boolean(), false);
const teamNumber = whole(1, 999_999);

export const pickEntrySchema = z.object({
	team: teamNumber,
	name: nothing(text(80)),
	note: z._default(text(300), ''),
	taken: z._default(z.boolean(), false)
});

export const pickListSchema = z.object({
	event: nothing(z.string().check(z.regex(/^[A-Z0-9]{2,24}$/))),
	entries: list(pickEntrySchema, LIMITS.picks)
});

export const batterySchema = z.object({
	id,
	name: text(24),
	status: z._default(z.enum(BATTERY_STATUSES), 'charged'),
	voltage: nothing(range(0, 30)),
	used: list(text(12), 60),
	note: z._default(text(200), ''),
	restedSince: nothing(stamp)
});

export const batteriesSchema = z.object({
	items: list(batterySchema, LIMITS.batteries)
});

export const checkItemSchema = z.object({
	id,
	text: text(160),
	by: nothing(text(4)),
	at: nothing(stamp)
});

export const checkHistorySchema = z.object({
	match: z._default(text(16), ''),
	at: stamp,
	done: whole(0, 100),
	total: whole(0, 100),
	by: list(text(4), 20)
});

export const checklistSchema = z.object({
	match: z._default(text(16), ''),
	items: list(checkItemSchema, LIMITS.checks),
	history: list(checkHistorySchema, LIMITS.history)
});

const penSchema = z.object({
	id,
	kind: z.literal('pen'),
	color,
	dash,
	pts: z.array(coordinate).check(
		z.minLength(2),
		z.maxLength(LIMITS.penValues),
		z.refine((values) => values.length % 2 === 0)
	)
});

const arrowSchema = z.object({
	id,
	kind: z.literal('arrow'),
	color,
	dash,
	pts: z.tuple([coordinate, coordinate, coordinate, coordinate])
});

const robotSchema = z.object({
	id,
	kind: z.literal('robot'),
	color,
	x: coordinate,
	y: coordinate,
	label: text(8)
});

const labelSchema = z.object({
	id,
	kind: z.literal('text'),
	color,
	x: coordinate,
	y: coordinate,
	text: z.string().check(z.minLength(1), z.maxLength(60))
});

export const shapeSchema = z.discriminatedUnion('kind', [
	penSchema,
	arrowSchema,
	robotSchema,
	labelSchema
]);

export const planSchema = z.object({
	id,
	name: z._default(text(60), 'Plan'),
	notes: z._default(text(2000), ''),
	shapes: list(shapeSchema, LIMITS.shapes),
	updatedAt: z._default(stamp, 0)
});

export const boardsSchema = z.object({
	plans: list(planSchema, LIMITS.plans)
});

export const DOC_SCHEMAS = {
	picklist: pickListSchema,
	batteries: batteriesSchema,
	checklist: checklistSchema,
	boards: boardsSchema
} as const;

export const REV_PATTERN = /^[a-z0-9]{8,40}$/;

export const metaSchema = z.object({
	code: z.string().check(z.regex(CODE_PATTERN)),
	teamNumber: z.nullable(teamNumber),
	createdAt: stamp
});

export type PickEntry = z.output<typeof pickEntrySchema>;
export type PickList = z.output<typeof pickListSchema>;
export type Battery = z.output<typeof batterySchema>;
export type Batteries = z.output<typeof batteriesSchema>;
export type CheckItem = z.output<typeof checkItemSchema>;
export type CheckHistory = z.output<typeof checkHistorySchema>;
export type Checklist = z.output<typeof checklistSchema>;
export type Shape = z.output<typeof shapeSchema>;
export type PenShape = Extract<Shape, { kind: 'pen' }>;
export type ArrowShape = Extract<Shape, { kind: 'arrow' }>;
export type RobotShape = Extract<Shape, { kind: 'robot' }>;
export type TextShape = Extract<Shape, { kind: 'text' }>;
export type Plan = z.output<typeof planSchema>;
export type Boards = z.output<typeof boardsSchema>;
export type WorkspaceMeta = z.output<typeof metaSchema>;

export type DocMap = {
	picklist: PickList;
	batteries: Batteries;
	checklist: Checklist;
	boards: Boards;
};

export type Stamped<T> = { updatedAt: number; data: T };

export type Docs = { [K in DocName]?: Stamped<DocMap[K]> };

export type Snapshot = { meta: WorkspaceMeta; docs: Docs; rev?: string; key?: string };

const stamped = <T extends z.ZodMiniType>(schema: T) =>
	z.object({ updatedAt: stamp, data: schema });

export const stampedSchemas = {
	picklist: stamped(pickListSchema),
	batteries: stamped(batteriesSchema),
	checklist: stamped(checklistSchema),
	boards: stamped(boardsSchema)
} as const;

export const snapshotSchema = z.object({
	meta: metaSchema,
	docs: z._default(
		z.object({
			picklist: z.optional(stampedSchemas.picklist),
			batteries: z.optional(stampedSchemas.batteries),
			checklist: z.optional(stampedSchemas.checklist),
			boards: z.optional(stampedSchemas.boards)
		}),
		{}
	),
	rev: z.optional(z.string().check(z.regex(REV_PATTERN))),
	key: z.optional(z.string().check(z.regex(REV_PATTERN)))
});

const shareBase = {
	v: z.literal(1),
	from: nothing(z.string().check(z.regex(CODE_PATTERN))),
	team: nothing(teamNumber),
	at: stamp
};

export const sharePayloadSchema = z.discriminatedUnion('tool', [
	z.object({ ...shareBase, tool: z.literal('picklist'), data: pickListSchema }),
	z.object({ ...shareBase, tool: z.literal('batteries'), data: batteriesSchema }),
	z.object({ ...shareBase, tool: z.literal('checklist'), data: checklistSchema }),
	z.object({ ...shareBase, tool: z.literal('board'), data: planSchema })
]);

export type SharePayload = z.output<typeof sharePayloadSchema>;

export const TOOL_DOC: Record<ShareTool, DocName> = {
	picklist: 'picklist',
	batteries: 'batteries',
	checklist: 'checklist',
	board: 'boards'
};

export function emptyDoc<K extends DocName>(name: K): DocMap[K] {
	return DOC_SCHEMAS[name].parse({}) as DocMap[K];
}

export function emptyDocs(): DocMap {
	return {
		picklist: emptyDoc('picklist'),
		batteries: emptyDoc('batteries'),
		checklist: emptyDoc('checklist'),
		boards: emptyDoc('boards')
	};
}

export function parseDoc<K extends DocName>(name: K, value: unknown): DocMap[K] | null {
	const result = DOC_SCHEMAS[name].safeParse(value);
	return result.success ? (result.data as DocMap[K]) : null;
}

export function putDoc<K extends DocName>(docs: Docs, name: K, stamped: Stamped<DocMap[K]>): void {
	Object.assign(docs, { [name]: stamped });
}
