import { httpUrl } from '#lib/format/url.ts';
import type { Event } from '#lib/types.ts';

const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'youtu.be',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com'
]);
const TWITCH_HOSTS = new Set(['twitch.tv', 'www.twitch.tv', 'm.twitch.tv']);
const TWITCH_RESERVED = new Set([
	'directory',
	'downloads',
	'jobs',
	'p',
	'search',
	'settings',
	'store',
	'turbo',
	'videos'
]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL = /^[A-Za-z0-9_]{1,25}$/;

export function eventStream(event: Pick<Event, 'liveStreamUrl' | 'webcasts'>): string | null {
	return [event.liveStreamUrl, ...event.webcasts].map(httpUrl).find((url) => url !== null) ?? null;
}

function youtubeId(url: URL): string | null {
	const parts = url.pathname.split('/').filter(Boolean);
	const id =
		url.hostname === 'youtu.be'
			? parts[0]
			: parts[0] === 'watch'
				? url.searchParams.get('v')
				: ['live', 'embed', 'shorts', 'v'].includes(parts[0])
					? parts[1]
					: null;
	return id && VIDEO_ID.test(id) ? id : null;
}

function twitchEmbed(url: URL, parent: string): string | null {
	const parts = url.pathname.split('/').filter(Boolean);
	const params = new URLSearchParams({ parent, autoplay: 'true', muted: 'true' });
	if (parts[0] === 'videos' && /^\d{1,12}$/.test(parts[1] ?? '')) {
		params.set('video', `v${parts[1]}`);
	} else if (parts.length === 1 && CHANNEL.test(parts[0]) && !TWITCH_RESERVED.has(parts[0])) {
		params.set('channel', parts[0].toLowerCase());
	} else {
		return null;
	}
	return `https://player.twitch.tv/?${params}`;
}

export function streamEmbed(link: string | null, parent: string): string | null {
	const href = httpUrl(link);
	if (!href || !parent) return null;
	const url = new URL(href);
	const host = url.hostname.toLowerCase();
	if (YOUTUBE_HOSTS.has(host)) {
		const id = youtubeId(url);
		return id
			? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1`
			: null;
	}
	if (TWITCH_HOSTS.has(host)) return twitchEmbed(url, parent);
	return null;
}
