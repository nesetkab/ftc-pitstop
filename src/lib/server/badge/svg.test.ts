import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SeasonRatings, SeasonRating } from '#lib/analysis/types.ts';
import { BADGE_STATS } from '#lib/badge/links.ts';
import { teamEvent, teamSeason } from '#lib/components/team/fixtures.ts';
import type { TeamEventStats, TeamSeason } from '#lib/types.ts';
import { badgeFacts, badgeText, cardData, missingCard, MISSING_BADGE } from './load.ts';
import { fitText, textWidth } from './measure.ts';
import {
	BADGE_LABEL_FONT,
	BADGE_MAX_LABEL,
	BADGE_MAX_VALUE,
	BADGE_PAD,
	BADGE_VALUE_FONT,
	badgeLayout,
	CARD_LABEL_FONT,
	CARD_NAME_FONT,
	CARD_PAD,
	CARD_VALUE_FONT,
	CARD_WIDTH,
	cardColumns,
	cardHeader,
	escapeXml,
	renderBadge,
	renderCard,
	sparkPoints
} from './svg.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const HOSTILE = `<script>alert("x")</script> & 'Bots' ]]> \u0007‮`;

beforeAll(async () => {
	const require = createRequire(import.meta.url);
	await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'))).catch(
		(error: unknown) => {
			if (!String(error).includes('Already initialized')) throw error;
		}
	);
});

function parses(svg: string): boolean {
	new Resvg(svg).render();
	return true;
}

function stats(wins: number, losses: number, opr: number): TeamEventStats {
	return {
		rank: 3,
		rs: 2,
		tbp: 10,
		avgTips: 0,
		wins,
		losses,
		ties: 1,
		dq: 0,
		played: wins + losses + 1,
		opr: { total: opr, auto: 10, teleop: opr - 10 }
	};
}

function rating(team: number, opr: number, region: string | null): SeasonRating {
	return {
		team,
		opr,
		parts: { auto: 10, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 },
		matches: 10,
		events: 2,
		rank: 0,
		percentile: 0,
		region
	};
}

const ratings: SeasonRatings = {
	generatedAt: NOW,
	teams: [
		rating(1, 150, 'USAZ'),
		rating(2, 120, 'USCA'),
		rating(26670, 100, 'USAZ'),
		rating(4, 90, 'USAZ'),
		rating(5, 80, 'USTX')
	]
};

function season(name = 'SCA Iron Eagles'): TeamSeason {
	return {
		...teamSeason(26670, name, [
			{
				...teamEvent({ code: 'B', start: '2026-11-14', end: '2026-11-14' }),
				stats: stats(5, 1, 90)
			},
			{
				...teamEvent({ code: 'A', start: '2026-10-31', end: '2026-10-31' }),
				stats: stats(4, 2, 70)
			},
			teamEvent({
				code: 'C',
				name: 'Diamondback - Tucson Qualifier',
				start: '2026-12-12',
				end: '2026-12-12',
				timezone: 'America/Phoenix'
			})
		])
	};
}

describe('escaping', () => {
	it('escapes markup and drops characters XML cannot hold', () => {
		const escaped = escapeXml(HOSTILE);
		expect(escaped).not.toMatch(/[<>"']/);
		expect(escaped).toContain(
			'&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Bots&#39;'
		);
		expect(escaped).not.toContain('\u0007');
		expect(escaped).not.toContain('‮');
	});

	it('checks markup with a real SVG parser', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">';
		expect(() => parses(`${svg}<text>a & b</text></svg>`)).toThrow();
		expect(() => parses(`${svg}<text><script></text></svg>`)).toThrow();
		expect(parses(`${svg}<text>${escapeXml('a & <b>')}</text></svg>`)).toBe(true);
	});

	it('never lets a team name open an element in the badge or the card', () => {
		const facts = badgeFacts(season(HOSTILE), ratings, NOW);
		const outputs = [
			...BADGE_STATS.map((stat) => renderBadge(badgeText(facts, stat), 'light')),
			renderBadge(badgeText(facts, null), 'dark'),
			renderCard(cardData(facts), 'light')
		];
		for (const svg of outputs) {
			expect(svg).not.toContain('<script');
			expect(svg).not.toContain('\u0007');
			expect(parses(svg)).toBe(true);
		}
		expect(renderCard(cardData(facts), 'dark')).toContain('&lt;script&gt;');
	});
});

describe('text widths', () => {
	it('grows with the text and is wider for bold and wide letters', () => {
		expect(textWidth('WWWW', { size: 11 })).toBeGreaterThan(textWidth('iiii', { size: 11 }));
		expect(textWidth('Robots', { size: 11, bold: true })).toBeGreaterThan(
			textWidth('Robots', { size: 11 })
		);
		expect(textWidth('ロボット', { size: 11 })).toBeGreaterThanOrEqual(44);
		expect(textWidth('Équipe', { size: 11 })).toBe(textWidth('Equipe', { size: 11 }));
	});

	it('cuts text to fit with an ellipsis', () => {
		const long = 'The Extremely Long Robotics Team Name From Somewhere Far Away';
		const cut = fitText(long, { size: 14 }, 120);
		expect(cut.endsWith('…')).toBe(true);
		expect(textWidth(cut, { size: 14 })).toBeLessThanOrEqual(120);
		expect(fitText('Short', { size: 14 }, 120)).toBe('Short');
	});

	it('sizes every badge so its text fits inside its own half', () => {
		const samples = [
			{ label: 'FTC 1', value: 'aOPR 1.0' },
			{
				label: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
				value: 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM'
			},
			{ label: '26670 rank in Texas West and Panhandle', value: '1,234th of 7,401' },
			{ label: 'ロボット 26670', value: '東京ロボティクス選手権大会 · Dec 12' },
			{ label: HOSTILE, value: HOSTILE }
		];
		for (const sample of samples) {
			const layout = badgeLayout(sample);
			const label = textWidth(layout.label, BADGE_LABEL_FONT);
			const value = textWidth(layout.value, BADGE_VALUE_FONT);
			expect(label + BADGE_PAD * 2).toBeLessThanOrEqual(layout.labelWidth);
			expect(value + BADGE_PAD * 2).toBeLessThanOrEqual(layout.valueWidth);
			expect(label).toBeLessThanOrEqual(BADGE_MAX_LABEL);
			expect(value).toBeLessThanOrEqual(BADGE_MAX_VALUE);
			expect(layout.width).toBe(layout.labelWidth + layout.valueWidth);
			const svg = renderBadge(sample, 'light');
			expect(svg).toContain(`width="${layout.width}"`);
			for (const match of svg.matchAll(/textLength="([\d.]+)"/g)) {
				expect(Number(match[1])).toBeLessThanOrEqual(
					Math.max(layout.labelWidth, layout.valueWidth)
				);
			}
		}
	});

	it('keeps card names clear of the sparkline and stats inside their columns', () => {
		const header = cardHeader({
			title: '26670',
			name: 'A Remarkably Long Team Name That Keeps Going And Going',
			trend: [1, 2, 3]
		});
		expect(header.nameX + textWidth(header.name, CARD_NAME_FONT)).toBeLessThanOrEqual(header.right);
		const columns = cardColumns([
			{ label: 'Season aOPR', value: '1234.5' },
			{ label: 'World rank', value: '12,345', suffix: 'of 12,345' },
			{ label: 'Rank in Texas West and Panhandle', value: '1,234', suffix: 'of 1,234' },
			{ label: 'Qual record', value: '120-120-12' }
		]);
		for (const column of columns) {
			expect(textWidth(column.label, CARD_LABEL_FONT)).toBeLessThan(column.width);
			expect(textWidth(column.value, CARD_VALUE_FONT)).toBeLessThan(column.width);
			expect(column.x + column.width).toBeLessThanOrEqual(CARD_WIDTH - CARD_PAD);
		}
		expect(columns[2].label.endsWith('…')).toBe(true);
	});

	it('draws the sparkline inside its box', () => {
		const box = { x: 300, y: 17, width: 80, height: 24 };
		const points = sparkPoints([40, 90, 60, 120], box);
		expect(points).toHaveLength(4);
		for (const [x, y] of points) {
			expect(x).toBeGreaterThanOrEqual(box.x);
			expect(x).toBeLessThanOrEqual(box.x + box.width);
			expect(y).toBeGreaterThanOrEqual(box.y);
			expect(y).toBeLessThanOrEqual(box.y + box.height);
		}
		expect(points[3][1]).toBe(box.y);
		expect(sparkPoints([50], box)).toEqual([]);
		expect(sparkPoints([50, 50], box).every(([, y]) => y === box.y + box.height / 2)).toBe(true);
	});
});

describe('badge text', () => {
	const facts = badgeFacts(season(), ratings, NOW);

	it('works out the numbers from season ratings', () => {
		expect(facts).toMatchObject({
			opr: 100,
			world: { rank: 3, of: 5 },
			region: { rank: 2, of: 3, name: 'Arizona' },
			record: { wins: 9, losses: 3, ties: 2 },
			next: { name: 'Diamondback - Tucson Qualifier', start: '2026-12-12', live: false },
			trend: [70, 90],
			complete: true
		});
	});

	it('writes each variant', () => {
		expect(badgeText(facts, null)).toEqual({
			label: 'FTC 26670',
			value: 'aOPR 100.0 · 3rd worldwide'
		});
		expect(badgeText(facts, 'opr')).toEqual({ label: '26670 season aOPR', value: '100.0' });
		expect(badgeText(facts, 'rank')).toEqual({ label: '26670 world rank', value: '3rd of 5' });
		expect(badgeText(facts, 'region')).toEqual({
			label: '26670 rank in Arizona',
			value: '2nd of 3'
		});
		expect(badgeText(facts, 'record')).toEqual({ label: '26670 qual record', value: '9-3-2' });
		expect(badgeText(facts, 'next')).toEqual({
			label: '26670 next event',
			value: 'Diamondback - Tucson Qualifier · Dec 12'
		});
	});

	it('says when an event is on now', () => {
		const live = badgeFacts(season(), ratings, Date.parse('2026-12-12T18:00:00Z'));
		expect(badgeText(live, 'next').value).toBe('Diamondback - Tucson Qualifier · now');
	});

	it('falls back to quick stats and plain words when there is no rating', () => {
		const quiet = badgeFacts(teamSeason(30000, 'New Team'), null, NOW);
		expect(quiet.complete).toBe(false);
		expect(badgeText(quiet, null).value).toBe('no matches yet');
		expect(badgeText(quiet, 'rank').value).toBe('not ranked yet');
		expect(badgeText(quiet, 'region')).toEqual({
			label: '30000 region rank',
			value: 'not ranked yet'
		});
		expect(badgeText(quiet, 'record').value).toBe('no matches yet');
		expect(badgeText(quiet, 'next').value).toBe('none scheduled');
		const quick = badgeFacts(
			{
				...teamSeason(30000, 'New Team'),
				quickStats: {
					season: 2026,
					total: { value: 55.5, rank: 1200 },
					auto: { value: 1, rank: 1 },
					teleop: { value: 1, rank: 1 },
					endgame: { value: 1, rank: 1 },
					count: 4000
				}
			},
			null,
			NOW
		);
		expect(badgeText(quick, null).value).toBe('aOPR 55.5 · 1,200th worldwide');
		expect(badgeText(quick, 'rank').value).toBe('1,200th of 4,000');
	});

	it('renders the card with every stat and a sparkline', () => {
		const svg = renderCard(cardData(facts), 'light');
		expect(svg).toContain('width="400" height="120"');
		expect(svg).toContain('>SCA Iron Eagles<');
		expect(svg).toContain('>Rank in Arizona<');
		expect(svg).toContain('>9-3-2<');
		expect(svg).toContain('<polyline');
		expect(parses(svg)).toBe(true);
	});

	it('keeps the not found images neutral', () => {
		const badge = renderBadge(MISSING_BADGE, 'light');
		expect(badge).toContain('team not found');
		const card = renderCard(missingCard(), 'dark');
		expect(card).toContain('Team not found');
		for (const svg of [badge, card, renderBadge(badgeText(facts, null), 'dark')]) {
			expect(svg.toLowerCase()).not.toMatch(/#f2c200|#ffd21a|#fbf1c7/);
			expect(parses(svg)).toBe(true);
		}
	});
});
