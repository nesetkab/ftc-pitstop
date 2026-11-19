import { untrack } from 'svelte';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { replayBundle, replayClock, type ReplaySettings } from '#lib/game/replay.ts';
import type { EventBundle, QueueStatusSnapshot } from '#lib/types.ts';
import { PitFeed } from './feed.svelte.ts';
import { connection as connectionState, isStale } from './poll.ts';
import { queueCall } from './queue.ts';
import { bundleSignature, pitView } from './view.ts';

export interface AnalysisRequest {
	code: string;
	at: number | null;
	version: string;
}

export type AnalysisLoader = (request: AnalysisRequest) => Promise<EventAnalysis | null>;

export interface SessionOptions {
	team: number;
	code: string;
	bundle: EventBundle | null;
	analysis: EventAnalysis | null;
	queue: QueueStatusSnapshot | null;
	nexus: boolean;
	replay: ReplaySettings | null;
	loadAnalysis?: AnalysisLoader;
	fetch?: typeof fetch;
}

const LIVE = new Set(['quals', 'selection', 'playoffs']);

export class PitSession {
	readonly team: number;
	readonly code: string;
	readonly replay: ReplaySettings | null;
	readonly feed: PitFeed;

	now = $state(Date.now());
	analysis = $state.raw<EventAnalysis | null>(null);
	dismissed = $state<string | null>(null);

	#origin = Date.now();
	#loadAnalysis: AnalysisLoader | null;
	#version: string | null;
	#request = 0;

	clock = $derived.by(() =>
		this.replay ? replayClock(this.replay, this.#origin, this.now) : this.now
	);

	bundle = $derived.by(() => {
		const source = this.feed.bundle;
		if (!source) return null;
		return this.replay ? replayBundle(source, this.clock) : source;
	});

	signature = $derived.by(() => (this.bundle ? bundleSignature(this.bundle) : null));

	view = $derived.by(() =>
		this.bundle
			? pitView({
					bundle: this.bundle,
					analysis: this.analysis,
					queue: this.replay ? null : this.feed.queue,
					team: this.team
				})
			: null
	);

	call = $derived.by(() => queueCall(this.view?.next ?? null, this.clock));

	takeover = $derived.by(() => (this.call && this.call.key !== this.dismissed ? this.call : null));

	connection = $derived.by(() => connectionState(this.feed.failures, this.feed.online));

	stale = $derived.by(
		() =>
			isStale(this.feed.updatedAt, this.now) ||
			(!this.replay &&
				this.bundle !== null &&
				LIVE.has(this.bundle.phase) &&
				isStale(this.bundle.fetchedAt, this.now))
	);

	constructor(options: SessionOptions) {
		this.team = options.team;
		this.code = options.code;
		this.replay = options.replay;
		this.analysis = options.analysis;
		this.#loadAnalysis = options.loadAnalysis ?? null;
		this.feed = new PitFeed({
			code: options.code,
			bundle: options.bundle,
			queue: options.queue,
			nexus: options.nexus,
			fetch: options.fetch
		});
		this.#version = untrack(() => this.signature);
	}

	dismiss() {
		if (this.call) this.dismissed = this.call.key;
	}

	start(): () => void {
		const stop = this.feed.start();
		const timer = setInterval(() => (this.now = Date.now()), 1000);
		return () => {
			clearInterval(timer);
			stop();
		};
	}

	async refreshAnalysis() {
		const version = this.signature;
		if (!version || !this.#loadAnalysis || version === this.#version) return;
		this.#version = version;
		const request = ++this.#request;
		try {
			const analysis = await this.#loadAnalysis({
				code: this.code,
				at: this.replay ? Math.round(this.clock) : null,
				version
			});
			if (request === this.#request) this.analysis = analysis;
		} catch {
			if (request === this.#request) this.#version = null;
		}
	}
}
