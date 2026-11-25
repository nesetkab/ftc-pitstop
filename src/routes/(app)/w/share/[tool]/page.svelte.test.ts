import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeShare, sharePayload } from '#lib/workspace/share.ts';
import Page from './+page.svelte';

afterEach(() => {
	cleanup();
	location.hash = '';
});

function props(tool: 'checklist' | 'picklist') {
	return { data: { tool }, params: { tool } } as never;
}

describe('shared copy page', () => {
	it('loads and shows the shared checklist', async () => {
		const payload = sharePayload(
			'checklist',
			{
				match: 'Q12',
				items: [{ id: 'i1', text: 'Charge the spare battery', by: null, at: null }],
				history: []
			},
			{ from: null, team: 3747, now: 1 }
		);
		location.hash = await encodeShare(payload);
		render(Page, { props: props('checklist') });
		expect(await screen.findByText('Charge the spare battery')).toBeInTheDocument();
		expect(screen.getByText('From team 3747.')).toBeInTheDocument();
	});

	it('says the link is damaged when the hash is for another tool', async () => {
		const payload = sharePayload(
			'checklist',
			{ match: '', items: [], history: [] },
			{ from: null, team: null, now: 1 }
		);
		location.hash = await encodeShare(payload);
		render(Page, { props: props('picklist') });
		expect(await screen.findByText('This link is damaged or incomplete.')).toBeInTheDocument();
	});
});
