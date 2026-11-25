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
	it('links a known abbreviation to the glossary and describes it with a tooltip', () => {
		render(Term, { props: { label: 'RS' } });
		const link = screen.getByRole('link', { name: 'RS' });
		expect(link).toHaveAttribute('href', '/about#term-rs');
		const tip = tipFor(link);
		expect(tip).toHaveAttribute('role', 'tooltip');
		expect(tip).toHaveTextContent(explain('RS')!);
		expect(link).toHaveAccessibleDescription(explain('RS')!);
		expect(link).not.toHaveAttribute('title');
	});

	it('can show a short label while explaining a longer term', () => {
		render(Term, { props: { label: 'Auto', term: 'Auto aOPR' } });
		const link = screen.getByRole('link', { name: 'Auto' });
		expect(link).toHaveAttribute('href', '/about#term-auto-aopr');
		expect(tipFor(link)).toHaveTextContent(explain('Auto aOPR')!);
	});

	it('becomes a tooltip button when it should not link', () => {
		render(Term, { props: { label: 'RS', link: false } });
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.getByRole('button', { name: 'RS' })).toHaveAccessibleDescription(explain('RS')!);
	});

	it('leaves plain words alone', () => {
		const { container } = render(Term, { props: { label: 'Team' } });
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
		expect(container).toHaveTextContent('Team');
	});

	it('shows on focus and tap, and hides on Escape and blur', async () => {
		render(Term, { props: { label: 'TBP', link: false } });
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

	it('shows the tooltip on the first tap of a linked term and follows the link on the next', async () => {
		render(Term, { props: { label: 'RS' } });
		const link = screen.getByRole('link', { name: 'RS' });
		const tip = tipFor(link);

		await fireEvent.pointerDown(link, { pointerType: 'touch' });
		expect(await fireEvent.click(link)).toBe(false);
		expect(tip).not.toHaveAttribute('hidden');

		await fireEvent.pointerDown(link, { pointerType: 'touch' });
		expect(await fireEvent.click(link)).toBe(true);
	});

	it('follows a linked term straight away on mouse click or keyboard', async () => {
		render(Term, { props: { label: 'RS' } });
		const link = screen.getByRole('link', { name: 'RS' });

		await fireEvent.pointerDown(link, { pointerType: 'mouse' });
		expect(await fireEvent.click(link)).toBe(true);
		await fireEvent.keyDown(document, { key: 'Escape' });
		expect(await fireEvent.click(link)).toBe(true);
	});

	it('removes its tooltip when it goes away', () => {
		const { unmount } = render(Term, { props: { label: 'aOPR' } });
		expect(document.querySelectorAll('.term-tip')).toHaveLength(1);
		unmount();
		expect(document.querySelectorAll('.term-tip')).toHaveLength(0);
	});

	it('describes the surrounding link instead of nesting a button inside it', () => {
		render(NestedTerm, { props: { label: 'RS' } });
		expect(screen.queryByRole('button')).toBeNull();
		const link = screen.getByRole('link', { name: 'RS' });
		expect(link).toHaveAttribute('href', '/sort');
		expect(link).toHaveAccessibleDescription(explain('RS')!);
	});
});
