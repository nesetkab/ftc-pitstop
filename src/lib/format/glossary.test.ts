import { describe, expect, it } from 'vitest';
import { RANKING_COLUMNS } from '#lib/components/event/ranking-columns.ts';
import { PART_LABELS, RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
import { explain, GLOSSARY, oprTerm, termHref, termId } from './glossary.ts';

describe('glossary', () => {
	it('explains the common abbreviations', () => {
		for (const term of ['RS', 'TBP', 'aOPR', 'NP avg', 'Avg tips', 'Poll. 1', 'Pred.', '#']) {
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

	it('explains every aOPR part and keeps the total as plain aOPR', () => {
		expect(oprTerm(PART_LABELS.total)).toBe('aOPR');
		expect(oprTerm('aOPR')).toBe('aOPR');
		for (const part of ['auto', 'teleop', 'hive', 'flower', 'garden', 'park', 'tips'] as const) {
			const term = oprTerm(PART_LABELS[part]);
			expect(explain(term), term).toMatch(/^Adjusted offensive power rating for /);
			expect(explain(PART_LABELS[part]), part).not.toMatch(/offensive power rating/);
		}
	});

	it('gives the rankings table the same wording as everywhere else', () => {
		const titled = RANKING_COLUMNS.filter((column) => explain(column.label)).map(
			(column) => column.label
		);
		expect(titled).toEqual(expect.arrayContaining(['RS', 'TBP', 'NP avg', 'Avg tips', 'aOPR']));
	});

	it('gives every term its own anchor on the about page', () => {
		const ids = Object.keys(GLOSSARY).map(termId);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^term-[a-z0-9]+(-[a-z0-9]+)*$/);
		expect(termId('#')).toBe('term-rank');
		expect(termHref('RS')).toBe('/about#term-rs');
		expect(termHref('Team')).toBeNull();
	});

	it('writes every entry as one plain sentence fragment', () => {
		for (const [term, text] of Object.entries(GLOSSARY)) {
			expect(text.length, term).toBeLessThan(90);
			expect(text, term).not.toMatch(/\.$/);
			expect(text[0], term).toBe(text[0].toUpperCase());
		}
	});
});
