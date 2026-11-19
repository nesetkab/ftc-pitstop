import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import FollowButton from './FollowButton.svelte';
import { FOLLOW_KEY, follows, parseFollows } from './follow.svelte.ts';

beforeEach(() => {
	localStorage.clear();
	follows.teams = [];
});

afterEach(() => {
	cleanup();
});

const stored = () => localStorage.getItem(FOLLOW_KEY);

describe('FollowButton', () => {
	it('starts as Follow when nothing is stored', async () => {
		render(FollowButton, { props: { number: 26670 } });
		expect(await screen.findByRole('button', { name: 'Follow' })).toBeInTheDocument();
		expect(stored()).toBeNull();
	});

	it('writes the team number to ps-follow and switches to Following', async () => {
		render(FollowButton, { props: { number: 26670 } });
		await fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
		expect(stored()).toBe('[26670]');
		expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
	});

	it('removes the team on a second click', async () => {
		render(FollowButton, { props: { number: 26670 } });
		await fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Following' }));
		expect(stored()).toBe('[]');
		expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
	});

	it('keeps the other teams that are already followed', async () => {
		localStorage.setItem(FOLLOW_KEY, '[3747]');
		render(FollowButton, { props: { number: 26670 } });
		await fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
		expect(stored()).toBe('[3747,26670]');
		await fireEvent.click(screen.getByRole('button', { name: 'Following' }));
		expect(stored()).toBe('[3747]');
	});

	it('shows Following for a team that was stored earlier', async () => {
		localStorage.setItem(FOLLOW_KEY, '[26670,3747]');
		render(FollowButton, { props: { number: 3747 } });
		expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument();
	});

	it('follows changes made in another tab', async () => {
		render(FollowButton, { props: { number: 26670 } });
		await screen.findByRole('button', { name: 'Follow' });
		localStorage.setItem(FOLLOW_KEY, '[26670]');
		window.dispatchEvent(new StorageEvent('storage', { key: FOLLOW_KEY }));
		expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument();
	});

	it('ignores stored data that is not a list of team numbers', async () => {
		localStorage.setItem(FOLLOW_KEY, '{"team":26670}');
		render(FollowButton, { props: { number: 26670 } });
		expect(await screen.findByRole('button', { name: 'Follow' })).toBeInTheDocument();
	});
});

describe('parseFollows', () => {
	it('keeps valid team numbers once each', () => {
		expect(parseFollows('[26670,3747,26670]')).toEqual([26670, 3747]);
	});

	it('drops values that are not team numbers', () => {
		expect(parseFollows('[26670,-1,0,1.5,"x",null,1000000]')).toEqual([26670]);
		expect(parseFollows('not json')).toEqual([]);
		expect(parseFollows(null)).toEqual([]);
	});
});
