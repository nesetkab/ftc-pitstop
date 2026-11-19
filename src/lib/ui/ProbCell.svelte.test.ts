import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ProbCell from './ProbCell.svelte';
import { heatAlpha, heatBackground } from './heat.ts';

function row() {
	const table = document.createElement('table');
	const body = table.createTBody();
	const tr = body.insertRow();
	document.body.append(table);
	return tr;
}

function cell(p: number | null | undefined, shade?: boolean) {
	const target = row();
	render(ProbCell, { target, props: { p, shade } });
	const td = target.querySelector('td');
	if (!td) throw new Error('ProbCell did not render a cell');
	return td;
}

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
});

describe('ProbCell', () => {
	it('shows whole percents with clamped tails', () => {
		expect(cell(0.586)).toHaveTextContent('59%');
		expect(cell(0.004)).toHaveTextContent('<1%');
		expect(cell(0.9971)).toHaveTextContent('>99%');
		expect(cell(0.5)).toHaveTextContent('50%');
	});

	it('shows a dash without shading when there is no value', () => {
		const td = cell(null);
		expect(td).toHaveTextContent('—');
		expect(td.style.background).toBe('');
	});

	it('shades by probability', () => {
		expect(cell(0.586).getAttribute('style')).toContain('rgba(var(--heat), 0.124)');
		expect(cell(1).getAttribute('style')).toContain('rgba(var(--heat), 0.190)');
		expect(cell(0).getAttribute('style')).toContain('rgba(var(--heat), 0.030)');
	});

	it('can turn shading off', () => {
		const td = cell(0.76, false);
		expect(td).toHaveTextContent('76%');
		expect(td.getAttribute('style')).toBeNull();
	});
});

describe('heat', () => {
	it('maps probability onto the heat ramp', () => {
		expect(heatAlpha(0)).toBeCloseTo(0.03);
		expect(heatAlpha(0.5)).toBeCloseTo(0.11);
		expect(heatAlpha(1)).toBeCloseTo(0.19);
		expect(heatAlpha(2)).toBeCloseTo(0.19);
		expect(heatBackground(undefined)).toBeUndefined();
	});
});
