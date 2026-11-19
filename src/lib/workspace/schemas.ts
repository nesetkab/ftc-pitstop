import { z } from 'zod';
import { CODE_PATTERN } from '#lib/workspace/code.ts';

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

const text = (max: number) => z.string().max(max);
const id = z.string().min(1).max(40);
const stamp = z.number().int().nonnegative();
const coordinate = z.number().min(-100).max(600);
const color = z.enum(SHAPE_COLORS).default('ink');
const dash = z.boolean().default(false);

export const pickEntrySchema = z.object({
	team: z.number().int().min(1).max(999_999),
	name: text(80).nullable().default(null),
	note: text(300).default(''),
	taken: z.boolean().default(false)
});

export const pickListSchema = z.object({
	event: z
		.string()
		.regex(/^[A-Z0-9]{2,24}$/)
		.nullable()
		.default(null),
	entries: z.array(pickEntrySchema).max(LIMITS.picks).default([])
});

export const batterySchema = z.object({
	id,
	name: text(24),
	status: z.enum(BATTERY_STATUSES).default('charged'),
	voltage: z.number().min(0).max(30).nullable().default(null),
	used: z.array(text(12)).max(60).default([]),
	note: text(200).default(''),
	restedSince: stamp.nullable().default(null)
});

export const batteriesSchema = z.object({
	items: z.array(batterySchema).max(LIMITS.batteries).default([])
});

export const checkItemSchema = z.object({
	id,
	text: text(160),
	by: text(4).nullable().default(null),
	at: stamp.nullable().default(null)
});

export const checkHistorySchema = z.object({
	match: text(16).default(''),
	at: stamp,
	done: z.number().int().min(0).max(100),
	total: z.number().int().min(0).max(100),
	by: z.array(text(4)).max(20).default([])
});

export const checklistSchema = z.object({
	match: text(16).default(''),
	items: z.array(checkItemSchema).max(LIMITS.checks).default([]),
	history: z.array(checkHistorySchema).max(LIMITS.history).default([])
});

const penSchema = z.object({
	id,
	kind: z.literal('pen'),
	color,
	dash,
	pts: z
		.array(coordinate)
		.min(2)
		.max(LIMITS.penValues)
		.refine((values) => values.length % 2 === 0)
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
	text: z.string().min(1).max(60)
});

export const shapeSchema = z.discriminatedUnion('kind', [
	penSchema,
	arrowSchema,
	robotSchema,
	labelSchema
]);

export const planSchema = z.object({
	id,
	name: text(60).default('Plan'),
	notes: text(2000).default(''),
	shapes: z.array(shapeSchema).max(LIMITS.shapes).default([]),
	updatedAt: stamp.default(0)
});

export const boardsSchema = z.object({
	plans: z.array(planSchema).max(LIMITS.plans).default([])
});

export const DOC_SCHEMAS = {
	picklist: pickListSchema,
	batteries: batteriesSchema,
	checklist: checklistSchema,
	boards: boardsSchema
} as const;

export const metaSchema = z.object({
	code: z.string().regex(CODE_PATTERN),
	teamNumber: z.number().int().min(1).max(999_999).nullable(),
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

export type Snapshot = { meta: WorkspaceMeta; docs: Docs };

const stamped = <T extends z.ZodType>(schema: T) => z.object({ updatedAt: stamp, data: schema });

export const stampedSchemas = {
	picklist: stamped(pickListSchema),
	batteries: stamped(batteriesSchema),
	checklist: stamped(checklistSchema),
	boards: stamped(boardsSchema)
} as const;

export const snapshotSchema = z.object({
	meta: metaSchema,
	docs: z
		.object({
			picklist: stampedSchemas.picklist.optional(),
			batteries: stampedSchemas.batteries.optional(),
			checklist: stampedSchemas.checklist.optional(),
			boards: stampedSchemas.boards.optional()
		})
		.default({})
});

const shareBase = {
	v: z.literal(1),
	from: z.string().regex(CODE_PATTERN).nullable().default(null),
	team: z.number().int().min(1).max(999_999).nullable().default(null),
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
