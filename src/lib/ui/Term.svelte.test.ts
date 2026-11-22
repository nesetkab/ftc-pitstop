import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { explain } from '#lib/format/glossary.ts';
import Term from './Term.svelte';

afterEach(cleanup);

describe('Term', () => {
	it('wraps a known abbreviation with its explanation', () => {
		const { container } = render(Term, { props: { label: 'RS' } });
		const abbr = container.querySelector('abbr');
		expect(abbr).toHaveTextContent('RS');
		expect(abbr).toHaveAttribute('title', explain('RS'));
	});

	it('can show a short label while explaining a longer term', () => {
		const { container } = render(Term, { props: { label: 'Auto', term: 'Auto OPR' } });
		expect(container.querySelector('abbr')).toHaveAttribute('title', explain('Auto OPR'));
	});

	it('links a known term to its glossary entry', () => {
		const { container } = render(Term, { props: { label: 'Auto', term: 'Auto OPR' } });
		expect(container.querySelector('a')).toHaveAttribute('href', '/about#term-auto-opr');
	});

	it('can skip the link when it sits inside another link', () => {
		const { container } = render(Term, { props: { label: 'RS', link: false } });
		expect(container.querySelector('a')).toBeNull();
		expect(container.querySelector('abbr')).toHaveAttribute('title', explain('RS'));
	});

	it('leaves plain words alone', () => {
		const { container } = render(Term, { props: { label: 'Team' } });
		expect(container.querySelector('abbr')).toBeNull();
		expect(container).toHaveTextContent('Team');
	});
});
