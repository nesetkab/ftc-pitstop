import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { ABOUT_SECTIONS } from '#lib/components/about/sections.ts';
import { GLOSSARY, termHref, termId } from '#lib/format/glossary.ts';
import { RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
import { PLAUSIBLE_SCORE } from '#lib/model/types.ts';
import Page from './+page.svelte';

afterEach(() => {
	cleanup();
});

function show() {
	return render(Page, { props: { data: {}, params: {} } as never });
}

describe('about page', () => {
	it('titles the page once and describes it for search', () => {
		show();
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About the numbers');
		expect(document.title).toBe('How PitStop’s FTC numbers work - PitStop');
		const description = document.head.querySelector('meta[name="description"]');
		expect(description?.getAttribute('content')).toMatch(/OPR/);
		const canonical = document.head.querySelector('link[rel="canonical"]');
		expect(canonical?.getAttribute('href')).toMatch(/\/about$/);
		const data = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(
			(node) => JSON.parse(node.textContent ?? '')
		);
		expect(data.map((item) => item['@type'])).toEqual(['TechArticle']);
		expect(data[0].articleSection).toEqual(ABOUT_SECTIONS.map((section) => section.title));
	});

	it('has a section with a heading and a contents link for every entry', () => {
		const { container } = show();
		const toc = screen.getByRole('navigation', { name: 'On this page' });
		for (const section of ABOUT_SECTIONS) {
			const element = container.querySelector(`section#${section.id}`);
			expect(element, section.id).not.toBeNull();
			expect(within(element as HTMLElement).getByRole('heading', { level: 2 })).toHaveTextContent(
				section.title
			);
			expect(within(toc).getByRole('link', { name: section.title })).toHaveAttribute(
				'href',
				`#${section.id}`
			);
		}
	});

	it('lists every glossary term under its own anchor', () => {
		const { container } = show();
		const glossary = container.querySelector('section#glossary') as HTMLElement;
		for (const [term, text] of Object.entries(GLOSSARY)) {
			const entry = glossary.querySelector(`[id="${termId(term)}"]`);
			expect(entry, term).not.toBeNull();
			expect(entry?.querySelector('dt'), term).toHaveTextContent(term);
			expect(entry?.querySelector('dd'), term).toHaveTextContent(text);
			expect(termHref(term)).toBe(`/about#${termId(term)}`);
		}
		expect(glossary.querySelectorAll('dt')).toHaveLength(Object.keys(GLOSSARY).length);
	});

	it('uses the live thresholds and links to the accuracy page', () => {
		const { container } = show();
		const points = container.querySelector('section#ranking-points') as HTMLElement;
		expect(points).toHaveTextContent(`${RP_THRESHOLDS.swarm} or more leave and park points`);
		expect(points).toHaveTextContent(`${RP_THRESHOLDS.pollinator2} or more hive tips`);
		const impossible = container.querySelector('section#impossible-scores') as HTMLElement;
		expect(impossible).toHaveTextContent(`above ${PLAUSIBLE_SCORE}`);
		const opr = container.querySelector('section#opr') as HTMLElement;
		expect(within(opr).getByRole('link', { name: 'accuracy page' })).toHaveAttribute(
			'href',
			'/accuracy'
		);
	});
});
