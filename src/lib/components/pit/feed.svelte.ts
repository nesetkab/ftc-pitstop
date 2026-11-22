import { OFFLINE_HEADER } from '#lib/pwa/rules.ts';
import type { EventBundle, QueueStatusSnapshot } from '#lib/types.ts';
import { BUNDLE_INTERVAL, bundleDelay, QUEUE_INTERVAL, queueActive, retryDelay } from './poll.ts';

export interface FeedOptions {
	code: string;
	bundle: EventBundle | null;
	queue: QueueStatusSnapshot | null;
	nexus: boolean;
	fetch?: typeof fetch;
	now?: () => number;
	pollHidden?: () => boolean;
}

type Channel = 'bundle' | 'queue';

export class PitFeed {
	bundle = $state.raw<EventBundle | null>(null);
	queue = $state.raw<QueueStatusSnapshot | null>(null);
	updatedAt = $state<number | null>(null);
	failures = $state(0);
	online = $state(true);

	#code: string;
	#nexus: boolean;
	#fetch: typeof fetch;
	#now: () => number;
	#pollHidden: () => boolean;
	#queueFailures = 0;
	#queueParked = false;
	#timers = new Map<Channel, ReturnType<typeof setTimeout>>();
	#running = false;

	constructor(options: FeedOptions) {
		this.#code = options.code;
		this.#nexus = options.nexus;
		this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
		this.#now = options.now ?? Date.now;
		this.#pollHidden = options.pollHidden ?? (() => false);
		this.bundle = options.bundle;
		this.queue = options.queue;
		this.updatedAt = options.bundle ? this.#now() : null;
	}

	get nexus(): boolean {
		return this.#nexus;
	}

	start(): () => void {
		if (this.#running) return () => this.stop();
		this.#running = true;
		this.online = typeof navigator === 'undefined' ? true : navigator.onLine;
		const online = () => {
			this.online = true;
			this.refresh();
		};
		const offline = () => {
			this.online = false;
		};
		const visible = () => {
			if (document.visibilityState === 'visible') this.refresh();
		};
		addEventListener('online', online);
		addEventListener('offline', offline);
		document.addEventListener('visibilitychange', visible);
		this.#schedule(
			'bundle',
			this.bundle && this.online ? bundleDelay(this.bundle, this.#now()) : 0
		);
		if (this.#nexus) this.#schedule('queue', this.queue ? QUEUE_INTERVAL : 0);
		return () => {
			removeEventListener('online', online);
			removeEventListener('offline', offline);
			document.removeEventListener('visibilitychange', visible);
			this.stop();
		};
	}

	stop() {
		this.#running = false;
		for (const timer of this.#timers.values()) clearTimeout(timer);
		this.#timers.clear();
	}

	refresh() {
		if (!this.#running) return;
		this.#schedule('bundle', 0);
		if (this.#nexus) this.#wakeQueue();
	}

	#wakeQueue() {
		this.#queueParked = false;
		this.#schedule('queue', 0);
	}

	#schedule(channel: Channel, delay: number | null) {
		clearTimeout(this.#timers.get(channel));
		this.#timers.delete(channel);
		if (!this.#running || delay === null) return;
		this.#timers.set(
			channel,
			setTimeout(() => {
				this.#timers.delete(channel);
				void (channel === 'bundle' ? this.#pollBundle() : this.#pollQueue());
			}, delay)
		);
	}

	#asleep(): boolean {
		return (
			typeof document !== 'undefined' &&
			document.visibilityState === 'hidden' &&
			!this.#pollHidden()
		);
	}

	async #pollBundle() {
		if (this.#asleep()) return;
		try {
			const response = await this.#fetch(`/api/events/${this.#code}/lite`);
			if (!response.ok) throw new Error(`Event data returned ${response.status}`);
			const bundle = (await response.json()) as EventBundle;
			if (response.headers.get(OFFLINE_HEADER)) {
				if (!this.bundle || bundle.fetchedAt > this.bundle.fetchedAt) this.bundle = bundle;
				throw new Error('Served from the offline cache');
			}
			if (this.bundle && this.bundle.matches.length > 0 && bundle.matches.length === 0) {
				throw new Error('Event data lost its matches');
			}
			this.bundle = bundle;
			this.updatedAt = this.#now();
			this.failures = 0;
		} catch {
			this.failures++;
		}
		this.#schedule(
			'bundle',
			this.failures > 0
				? retryDelay(BUNDLE_INTERVAL, this.failures)
				: bundleDelay(this.bundle, this.#now())
		);
		if (this.#nexus && this.#queueParked) this.#wakeQueue();
	}

	async #pollQueue() {
		if (this.#asleep() || !queueActive(this.bundle, this.#now())) {
			this.#queueParked = true;
			return;
		}
		try {
			const response = await this.#fetch(`/api/nexus/${this.#code}`);
			if (response.status === 404) {
				this.#nexus = false;
				this.queue = null;
				return;
			}
			if (!response.ok || response.headers.get(OFFLINE_HEADER)) {
				throw new Error(`Queue status returned ${response.status}`);
			}
			this.queue = (await response.json()) as QueueStatusSnapshot;
			this.#queueFailures = 0;
		} catch {
			this.#queueFailures++;
			if (this.#queueFailures >= 3) this.queue = null;
		}
		this.#schedule('queue', retryDelay(QUEUE_INTERVAL, this.#queueFailures, 300_000));
	}
}
