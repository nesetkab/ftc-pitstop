import { describe, expect, it } from 'vitest';
import { eventStream, streamEmbed } from './stream.ts';

const HOST = 'www.ftcpitstop.com';
const youtube = (id: string) =>
	`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1`;

describe('eventStream', () => {
	it('prefers the listed stream and falls back to the first usable webcast', () => {
		expect(
			eventStream({
				liveStreamUrl: 'https://youtu.be/abcdefghijk',
				webcasts: ['https://twitch.tv/a']
			})
		).toBe('https://youtu.be/abcdefghijk');
		expect(
			eventStream({ liveStreamUrl: null, webcasts: ['javascript:alert(1)', 'https://twitch.tv/a'] })
		).toBe('https://twitch.tv/a');
		expect(eventStream({ liveStreamUrl: '  ', webcasts: [] })).toBeNull();
	});
});

describe('streamEmbed', () => {
	it('plays YouTube videos and live links muted from the privacy host', () => {
		for (const link of [
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30',
			'https://youtu.be/dQw4w9WgXcQ',
			'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
			'https://www.youtube.com/live/dQw4w9WgXcQ?si=share',
			'https://www.youtube.com/embed/dQw4w9WgXcQ',
			'https://youtube.com/shorts/dQw4w9WgXcQ'
		]) {
			expect(streamEmbed(link, HOST)).toBe(youtube('dQw4w9WgXcQ'));
		}
	});

	it('plays Twitch channels and videos with this site as the parent', () => {
		expect(streamEmbed('https://www.twitch.tv/FIRSTinspires', HOST)).toBe(
			'https://player.twitch.tv/?parent=www.ftcpitstop.com&autoplay=true&muted=true&channel=firstinspires'
		);
		expect(streamEmbed('https://twitch.tv/videos/123456789', 'localhost')).toBe(
			'https://player.twitch.tv/?parent=localhost&autoplay=true&muted=true&video=v123456789'
		);
	});

	it('leaves links it cannot play as plain links', () => {
		for (const link of [
			'https://www.youtube.com/@FIRSTinspires/live',
			'https://www.youtube.com/watch?v=short',
			'https://www.twitch.tv/directory',
			'https://www.twitch.tv/a/clip/b',
			'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
			'https://www.facebook.com/events/1',
			'javascript:alert(1)',
			null
		]) {
			expect(streamEmbed(link, HOST)).toBeNull();
		}
	});

	it('needs a parent host for Twitch', () => {
		expect(streamEmbed('https://twitch.tv/pitstop', '')).toBeNull();
	});
});
