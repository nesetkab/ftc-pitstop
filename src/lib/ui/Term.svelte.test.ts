import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { explain } from '#lib/format/glossary.ts';
import Term from './Term.svelte';
import NestedTerm from './NestedTerm.test.svelte';

afterEach(cleanup);

function tipFor(element: HTMLElement): HTMLElement {
	const id = element.getAttribute('aria-describedby');
	const tip = id ? document.getElementById(id) : null;
	if (!tip) throw new Error('no tooltip');
	return tip;
}

describe('Term', () => {
	it('makes a known abbreviation a button described by its explanation', () => {
		render(Term, { props: { label: 'RS' } });
		const button = screen.getByRole('button', { name: 'RS' });
		const tip = tipFor(button);
		expect(tip).toHaveAttribute('role', 'tooltip');
		expect(tip).toHaveTextContent(explain('RS')!);
		expect(button).toHaveAccessibleDescription(explain('RS')!);
		expect(button).not.toHaveAttribute('title');
	});

	it('can show a short label while explaining a longer term', () => {
		render(Term, { props: { label: 'Auto', term: 'Auto OPR' } });
		expect(tipFor(screen.getByRole('button', { name: 'Auto' }))).toHaveTextContent(
			explain('Auto OPR')!
		);
	});

	it('leaves plain words alone', () => {
		const { container } = render(Term, { props: { label: 'Team' } });
		expect(screen.queryByRole('button')).toBeNull();
		expect(container).toHaveTextContent('Team');
	});

	it('shows on focus and tap, and hides on Escape and blur', async () => {
		render(Term, { props: { label: 'TBP' } });
		const button = screen.getByRole('button', { name: 'TBP' });
		const tip = tipFor(button);
		expect(tip).toHaveAttribute('hidden');

		await fireEvent.focus(button);
		expect(tip).not.toHaveAttribute('hidden');
		await fireEvent.keyDown(document, { key: 'Escape' });
		expect(tip).toHaveAttribute('hidden');
		expect(button).toHaveAccessibleDescription(explain('TBP')!);

		await fireEvent.click(button);
		expect(tip).not.toHaveAttribute('hidden');
		await fireEvent.blur(button);
		expect(tip).toHaveAttribute('hidden');

		await fireEvent.click(button);
		await fireEvent.pointerDown(tip);
		expect(tip).not.toHaveAttribute('hidden');
		await fireEvent.pointerDown(document.body);
		expect(tip).toHaveAttribute('hidden');
	});

	it('removes its tooltip when it goes away', () => {
		const { unmount } = render(Term, { props: { label: 'OPR' } });
		expect(document.querySelectorAll('.term-tip')).toHaveLength(1);
		unmount();
		expect(document.querySelectorAll('.term-tip')).toHaveLength(0);
	});

	it('describes the surrounding link instead of nesting a button inside it', () => {
		render(NestedTerm, { props: { label: 'RS' } });
		expect(screen.queryByRole('button')).toBeNull();
		const link = screen.getByRole('link', { name: 'RS' });
		expect(link).toHaveAccessibleDescription(explain('RS')!);
	});
});
