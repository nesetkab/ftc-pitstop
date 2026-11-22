import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PredictionCard from './PredictionCard.svelte';

afterEach(() => {
	cleanup();
});

const red = { teams: [{ number: 724 }, { number: 8271 }], win: 0.62, score: 70 };
const blue = { teams: [{ number: 3747 }, { number: 17125 }], win: 0.38, score: 58 };

describe('PredictionCard', () => {
	it('names each alliance in visible text in the compact card', () => {
		render(PredictionCard, { props: { red, blue, compact: true } });
		const [, redRow, blueRow] = screen.getAllByRole('row');
		for (const [row, name] of [
			[redRow, 'Red'],
			[blueRow, 'Blue']
		] as const) {
			const label = row.querySelector('.teams > span') as HTMLElement;
			expect(label).toHaveTextContent(name);
			expect(label).not.toHaveClass('visually-hidden');
		}
	});

	it('uses the alliance chip in the full card', () => {
		render(PredictionCard, { props: { red, blue } });
		expect(screen.getByText('Red')).toBeInTheDocument();
		expect(screen.getByText('Blue')).toBeInTheDocument();
	});
});
