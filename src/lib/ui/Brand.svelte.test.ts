import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Brand from './Brand.svelte';

afterEach(cleanup);

describe('Brand', () => {
	it('sets FIRST in italics and keeps the rest of the text', () => {
		const { container } = render(Brand, { text: 'FIRST Championship and Tashkent FIRST Regional' });
		expect(container.textContent).toBe('FIRST Championship and Tashkent FIRST Regional');
		expect([...container.querySelectorAll('em')].map((em) => em.textContent)).toEqual([
			'FIRST',
			'FIRST'
		]);
	});

	it('leaves words that only contain FIRST alone', () => {
		const { container } = render(Brand, { text: 'FIRSTChampionship First' });
		expect(container.querySelector('em')).toBeNull();
		expect(container.textContent).toBe('FIRSTChampionship First');
	});
});
