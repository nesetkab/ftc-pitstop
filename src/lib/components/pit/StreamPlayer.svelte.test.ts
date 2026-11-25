import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StreamPlayer from './StreamPlayer.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('https://www.ftcpitstop.com/724') } }));

const KEY = 'ps-stream:USMTBUQ';
const frame = () => document.querySelector('iframe');

beforeEach(() => localStorage.clear());
afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe('StreamPlayer', () => {
	it('plays the stream listed for the event muted', () => {
		render(StreamPlayer, {
			props: { code: 'USMTBUQ', listed: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
		});
		expect(frame()?.getAttribute('src')).toBe(
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1'
		);
		expect(frame()).toHaveAttribute('title', 'Event live stream');
		expect(screen.getByText('Listed for this event')).toBeInTheDocument();
	});

	it('asks for a link when the event lists none and remembers it', async () => {
		render(StreamPlayer, { props: { code: 'USMTBUQ', listed: null } });
		expect(screen.getByText('No stream is listed for this event.')).toBeInTheDocument();
		expect(frame()).toBeNull();
		await fireEvent.input(screen.getByLabelText('Stream link'), {
			target: { value: 'https://www.twitch.tv/firstinspires' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
		expect(frame()?.getAttribute('src')).toContain('parent=www.ftcpitstop.com');
		expect(localStorage.getItem(KEY)).toBe('https://www.twitch.tv/firstinspires');
		expect(screen.getByText('Your link')).toBeInTheDocument();
	});

	it('links out to streams it cannot play', () => {
		render(StreamPlayer, {
			props: { code: 'USMTBUQ', listed: 'https://www.youtube.com/@FIRSTinspires/live' }
		});
		expect(frame()).toBeNull();
		expect(screen.getByRole('link', { name: 'Open the stream' })).toHaveAttribute(
			'href',
			'https://www.youtube.com/@FIRSTinspires/live'
		);
	});

	it('rejects text that is not a link', async () => {
		render(StreamPlayer, { props: { code: 'USMTBUQ', listed: null } });
		await fireEvent.input(screen.getByLabelText('Stream link'), {
			target: { value: 'javascript:alert(1)' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
		expect(screen.getByText('Paste a full link that starts with https.')).toBeInTheDocument();
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it('goes back to the listed stream after a saved link', async () => {
		localStorage.setItem(KEY, 'https://youtu.be/aaaaaaaaaaa');
		render(StreamPlayer, { props: { code: 'USMTBUQ', listed: 'https://youtu.be/bbbbbbbbbbb' } });
		expect(frame()?.getAttribute('src')).toContain('/embed/aaaaaaaaaaa');
		await fireEvent.click(screen.getByRole('button', { name: 'Change link' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Use listed stream' }));
		expect(frame()?.getAttribute('src')).toContain('/embed/bbbbbbbbbbb');
		expect(localStorage.getItem(KEY)).toBeNull();
	});
});
