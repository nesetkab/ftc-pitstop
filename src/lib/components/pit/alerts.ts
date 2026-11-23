import { ordinal } from '#lib/format/ordinal.ts';
import { dayTime } from '#lib/format/time.ts';
import type { EventPhase } from '#lib/types.ts';
import type { Outcome, PitView } from './view.ts';

export interface AlertSettings {
	twoBefore: boolean;
	scorePosted: boolean;
	rankChanges: boolean;
	selectionStarts: boolean;
}

export type AlertKey = keyof AlertSettings;

export const ALERT_KEY = 'ps-alerts';

export const DEFAULT_ALERTS: AlertSettings = {
	twoBefore: true,
	scorePosted: true,
	rankChanges: false,
	selectionStarts: true
};

export const ALERT_OPTIONS: { key: AlertKey; label: string; detail: string }[] = [
	{
		key: 'twoBefore',
		label: 'Two matches before ours',
		detail: 'Says which alliance we are on, who our partners are and when to queue.'
	},
	{
		key: 'scorePosted',
		label: 'Our score is posted',
		detail: 'Says whether we won and the final score.'
	},
	{
		key: 'rankChanges',
		label: 'Our rank changes',
		detail: 'Says our new rank and where we moved from.'
	},
	{
		key: 'selectionStarts',
		label: 'Alliance selection starts',
		detail: 'Says selection is starting and where we finished.'
	}
];

export const VIBRATE_KEY = 'ps-alert-vibrate';
export const VIBRATION = [200, 100, 200];

export function parseAlertSettings(raw: string | null): AlertSettings {
	if (!raw) return { ...DEFAULT_ALERTS };
	try {
		const value = JSON.parse(raw) as Partial<Record<AlertKey, unknown>>;
		const settings = { ...DEFAULT_ALERTS };
		for (const { key } of ALERT_OPTIONS) {
			if (typeof value?.[key] === 'boolean') settings[key] = value[key] as boolean;
		}
		return settings;
	} catch {
		return { ...DEFAULT_ALERTS };
	}
}

export interface AlertSnapshot {
	phase: EventPhase;
	rank: number | null;
	next: {
		key: string;
		label: string;
		alliance: 'red' | 'blue';
		partners: number[];
		matchesAway: number;
		queueAt: number | null;
	} | null;
	posted: {
		key: string;
		label: string;
		outcome: Outcome;
		ours: number;
		theirs: number;
		partners: number[];
	}[];
}

export interface PitAlert {
	id: string;
	title: string;
	body: string;
}

export function alertSnapshot(view: PitView): AlertSnapshot {
	const next = view.next;
	return {
		phase: view.phase,
		rank: view.ranking?.rank ?? null,
		next: next
			? {
					key: next.key,
					label: next.label,
					alliance: next.alliance,
					partners: next.partners,
					matchesAway: next.matchesAway,
					queueAt: next.queueAt
				}
			: null,
		posted: view.matches.flatMap((match) =>
			match.outcome && match.score
				? [
						{
							key: match.key,
							label: match.label,
							outcome: match.outcome,
							ours: match.score.ours,
							theirs: match.score.theirs,
							partners: match.partners
						}
					]
				: []
		)
	};
}

const AWAY = ['is next', 'is one match away', 'is two matches away'];
const OUTCOME: Record<Outcome, string> = { win: 'won', loss: 'lost', tie: 'tied' };

function allianceText(alliance: 'red' | 'blue', partners: number[]): string {
	const color = alliance === 'red' ? 'Red' : 'Blue';
	return partners.length > 0
		? `${color} alliance with ${partners.join(', ')}.`
		: `${color} alliance.`;
}

export function alertsBetween(
	before: AlertSnapshot | null,
	after: AlertSnapshot,
	settings: AlertSettings,
	timeZone: string,
	now: number
): PitAlert[] {
	if (!before) return [];
	const alerts: PitAlert[] = [];
	const next = after.next;
	if (settings.twoBefore && next && next.matchesAway <= 2) {
		const previous = before.next?.key === next.key ? before.next.matchesAway : Infinity;
		if (previous > 2) {
			const queue =
				next.queueAt === null ? '' : ` Queue at ${dayTime(next.queueAt, now, timeZone)}.`;
			alerts.push({
				id: `away:${next.key}`,
				title: `${next.label} ${AWAY[next.matchesAway]}`,
				body: `${allianceText(next.alliance, next.partners)}${queue}`
			});
		}
	}
	if (settings.scorePosted) {
		const seen = new Set(before.posted.map((match) => match.key));
		for (const match of after.posted) {
			if (seen.has(match.key)) continue;
			alerts.push({
				id: `score:${match.key}`,
				title: `${match.label}: ${OUTCOME[match.outcome]} ${match.ours}–${match.theirs}`,
				body: match.partners.length > 0 ? `With ${match.partners.join(', ')}.` : 'Score posted.'
			});
		}
	}
	if (
		settings.rankChanges &&
		before.rank !== null &&
		after.rank !== null &&
		before.rank !== after.rank
	) {
		const direction = after.rank < before.rank ? 'Up' : 'Down';
		alerts.push({
			id: `rank:${before.rank}:${after.rank}:${after.posted.length}`,
			title: `Now ranked ${ordinal(after.rank)}`,
			body: `${direction} from ${ordinal(before.rank)}.`
		});
	}
	if (settings.selectionStarts && before.phase !== 'selection' && after.phase === 'selection') {
		alerts.push({
			id: 'selection',
			title: 'Alliance selection is starting',
			body:
				after.rank === null
					? 'Qualification matches are done.'
					: `We finished ${ordinal(after.rank)}.`
		});
	}
	return alerts;
}

const NONE: AlertSettings = {
	twoBefore: false,
	scorePosted: false,
	rankChanges: false,
	selectionStarts: false
};

function previewPair(
	after: AlertSnapshot,
	key: AlertKey
): { before: AlertSnapshot; after: AlertSnapshot } | null {
	if (key === 'twoBefore') {
		if (!after.next) return null;
		const next = { ...after.next, matchesAway: Math.min(after.next.matchesAway, 2) };
		return { before: { ...after, next: null }, after: { ...after, next } };
	}
	if (key === 'scorePosted') {
		if (after.posted.length === 0) return null;
		const posted = after.posted.slice(-1);
		return { before: { ...after, posted: [] }, after: { ...after, posted } };
	}
	if (key === 'rankChanges') {
		if (after.rank === null) return null;
		return { before: { ...after, rank: after.rank + 1 }, after };
	}
	return { before: { ...after, phase: 'quals' }, after: { ...after, phase: 'selection' } };
}

export function alertPreview(
	view: PitView,
	key: AlertKey,
	timeZone: string,
	now: number
): PitAlert | null {
	const pair = previewPair(alertSnapshot(view), key);
	if (!pair) return null;
	return alertsBetween(pair.before, pair.after, { ...NONE, [key]: true }, timeZone, now)[0] ?? null;
}

export const TEST_ALERT: PitAlert = {
	id: 'test',
	title: 'PitStop alerts are on',
	body: 'Match alerts will look like this.'
};
