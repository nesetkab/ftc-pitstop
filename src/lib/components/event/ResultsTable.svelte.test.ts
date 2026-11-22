import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ResultsTable from './ResultsTable.svelte';
import { fixtureBundle } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

describe('ResultsTable', () => {
	it('names each alliance and the winner in text, not only by color', () => {
		const { matches } = fixtureBundle('USAZGIQ');
		render(ResultsTable, { props: { code: 'USAZGIQ', matches } });
		const q1 = matches.find((match) => match.key === 'q1')!;
		const group = screen.getByRole('link', { name: 'Q1' }).closest('tbody')!;
		const [red, blue] = [...group.querySelectorAll('tr')];
		expect(red.querySelector('td.l')).toHaveTextContent(/^Red \d/);
		expect(blue.querySelector('td.l')).toHaveTextContent(/^Blue \d/);
		const winner = q1.result!.winner === 'red' ? red : blue;
		expect(winner.querySelector('td.total')).toHaveTextContent(/^\d+, won$/);
	});
});
