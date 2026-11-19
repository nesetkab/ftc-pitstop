import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import LineChart from './LineChart.svelte';

beforeAll(() => {
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
});

afterEach(() => {
	cleanup();
});

const points = [
	{ label: 'Start', value: 0 },
	{ label: 'Q1', value: 30 },
	{ label: 'M1', value: 60 }
];

function draw(props: Partial<ComponentProps<typeof LineChart>> = {}) {
	const { container } = render(LineChart, {
		props: { points, label: 'EPA after each match', ...props }
	});
	return container;
}

describe('LineChart', () => {
	it('places points to scale inside the plot area', () => {
		const container = draw();
		const circles = [...container.querySelectorAll('circle')];
		expect(circles.map((circle) => Number(circle.getAttribute('cx')))).toEqual([34, 308, 582]);
		expect(circles.map((circle) => Number(circle.getAttribute('cy')))).toEqual([172, 98, 24]);
		expect(container.querySelector('path')?.getAttribute('d')).toBe(
			'M34.0,172.0 L308.0,98.0 L582.0,24.0'
		);
	});

	it('draws a gridline and label for each clean tick', () => {
		const container = draw();
		const ticks = [...container.querySelectorAll('text.tick')].map((text) => text.textContent);
		expect(ticks).toEqual(['0', '20', '40', '60']);
		const lines = [...container.querySelectorAll('line.grid')].map((line) =>
			Number(line.getAttribute('y1'))
		);
		[172, 122.667, 73.333, 24].forEach((y, index) => expect(lines[index]).toBeCloseTo(y, 2));
	});

	it('extends the axis to yMax', () => {
		const container = draw({ yMax: 100 });
		const ticks = [...container.querySelectorAll('text.tick')].map((text) => text.textContent);
		expect(ticks).toEqual(['0', '25', '50', '75', '100']);
		expect(Number(container.querySelectorAll('circle')[2].getAttribute('cy'))).toBeCloseTo(
			24 + 148 * 0.4
		);
	});

	it('draws the playoffs divider halfway between two points', () => {
		const container = draw({ divider: { after: 1, label: 'Playoffs' } });
		const divider = container.querySelector('line.divider');
		expect(Number(divider?.getAttribute('x1'))).toBe(445);
		expect(container.querySelector('text.divider-label')).toHaveTextContent('Playoffs');
	});

	it('labels every point and lists the values for screen readers', () => {
		const container = draw();
		const labels = [...container.querySelectorAll('text.x-label')].map((text) => text.textContent);
		expect(labels).toEqual(['Start', 'Q1', 'M1']);
		const table = screen.getByRole('table', { name: 'EPA after each match' });
		const cells = [...table.querySelectorAll('td')].map((cell) => cell.textContent);
		expect(cells).toEqual(['Start', '0.0', 'Q1', '30.0', 'M1', '60.0']);
	});
});
