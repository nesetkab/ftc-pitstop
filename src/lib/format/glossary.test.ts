import { describe, expect, it } from 'vitest';
import { RANKING_COLUMNS } from '#lib/components/event/ranking-columns.ts';
import { PART_LABELS, RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
import { explain, GLOSSARY, oprTerm } from './glossary.ts';

describe('glossary', () => {
	it('explains the common abbreviations', () => {
		for (const term of ['RS', 'TBP', 'OPR', 'NP avg', 'Avg tips', 'Poll. 1', 'Pred.', '#']) {
			expect(explain(term), term).toBeTruthy();
		}
	});

	it('answers null for words that need no help', () => {
		expect(explain('Team')).toBeNull();
		expect(explain('Total')).toBeNull();
		expect(explain('toString')).toBeNull();
		expect(explain('constructor')).toBeNull();
	});

	it('uses the live ranking point thresholds', () => {
		expect(explain('Swarm')).toContain(`${RP_THRESHOLDS.swarm}+`);
		expect(explain('Poll. 2')).toContain(`${RP_THRESHOLDS.pollinator2}+`);
	});

	it('explains every OPR part and keeps the total as plain OPR', () => {
		expect(oprTerm(PART_LABELS.total)).toBe('OPR');
		expect(oprTerm('OPR')).toBe('OPR');
		for (const part of ['auto', 'teleop', 'hive', 'flower', 'garden', 'park', 'tips'] as const) {
			const term = oprTerm(PART_LABELS[part]);
			expect(explain(term), term).toMatch(/^Offensive power rating for /);
			expect(explain(PART_LABELS[part]), part).not.toMatch(/Offensive power rating/);
		}
	});

	it('gives the rankings table the same wording as everywhere else', () => {
		const titled = RANKING_COLUMNS.filter((column) => explain(column.label)).map(
			(column) => column.label
		);
		expect(titled).toEqual(expect.arrayContaining(['RS', 'TBP', 'NP avg', 'Avg tips', 'OPR']));
	});

	it('writes every entry as one plain sentence fragment', () => {
		for (const [term, text] of Object.entries(GLOSSARY)) {
			expect(text.length, term).toBeLessThan(90);
			expect(text, term).not.toMatch(/\.$/);
			expect(text[0], term).toBe(text[0].toUpperCase());
		}
	});
});
