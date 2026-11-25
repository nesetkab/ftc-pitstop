import { untrack } from 'svelte';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { PitFeed } from '#lib/components/pit/feed.svelte.ts';
import { connection } from '#lib/components/pit/poll.ts';
import type { AnalysisLoader } from '#lib/components/pit/analysis-loader.ts';
import { bundleSignature } from '#lib/components/pit/progress.ts';
import { replayBundle, replayClock, type ReplaySettings } from '#lib/game/replay.ts';
import type { EventBundle } from '#lib/types.ts';
import { needsReload, nextBaseline, nowView, rankSnapshot, type RankSnapshot } from './now.ts';

export const LIVE_TICK = 5_000;
export const REPLAY_TICK = 1_000;

export interface NowSessionOptions {
	bundle: EventBundle;
	analysis: EventAnalysis | null;
	replay: ReplaySettings | null;
	reload: () => unknown;
	loadAnalysis?: AnalysisLoader;
	fetch?: typeof fetch;
	now?: () => number;
}

function newest(a: EventBundle | null, b: EventBundle): EventBundle {
	return a && a.fetchedAt > b.fetchedAt ? a : b;
}

export class NowSession {
	readonly feed: PitFeed;
	readonly replay: ReplaySettings | null;

	now: number;
	layout: EventBundle;
	analysis: EventAnalysis | null;

	#clock: () => number;
	#origin: number;
	#reload: () => unknown;
	#lastReload: number;
	#seen: RankSnapshot | null = null;
	#baseline: RankSnapshot | null = null;
	#loadAnalysis: AnalysisLoader | null;
	#fetch: typeof fetch;
	#version: string | null = null;
	#request = 0;

	clock = $derived.by(() =>
		this.replay ? replayClock(this.replay, this.#origin, this.now) : this.now
	);

	source = $derived.by(() => (this.replay ? this.layout : newest(this.feed.bundle, this.layout)));

	bundle = $derived.by(() => (this.replay ? replayBundle(this.source, this.clock) : this.source));

	signature = $derived.by(() => bundleSignature(this.bundle));

	baseline = $derived.by(() => {
		const current = rankSnapshot(this.bundle);
		this.#baseline = nextBaseline(this.#baseline, this.#seen, current);
		this.#seen = current;
		return this.#baseline;
	});

	view = $derived.by(() =>
		nowView({
			bundle: this.bundle,
			analysis: this.analysis,
			queue: this.replay ? null : this.feed.queue,
			baseline: this.baseline,
			now: this.clock
		})
	);

	connection = $derived.by(() => connection(this.feed.failures, this.feed.online));

	constructor(options: NowSessionOptions) {
		this.#clock = options.now ?? Date.now;
		this.now = $state(this.#clock());
		this.#origin = this.now;
		this.#lastReload = this.now;
		this.#reload = options.reload;
		this.replay = options.replay;
		this.layout = $state.raw(options.bundle);
		this.analysis = $state.raw(options.replay ? null : options.analysis);
		this.#loadAnalysis = options.loadAnalysis ?? null;
		this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
		this.feed = new PitFeed({
			code: options.bundle.event.code,
			bundle: options.bundle,
			queue: null,
			nexus: options.replay === null,
			fetch: options.fetch,
			now: options.now
		});
	}

	update(bundle: EventBundle, analysis: EventAnalysis | null) {
		if (this.replay) return;
		this.layout = bundle;
		this.analysis = analysis;
	}

	async loadScores() {
		try {
			const response = await this.#fetch(`/api/events/${this.layout.event.code}`);
			if (!response.ok) return;
			const bundle = (await response.json()) as EventBundle;
			if (bundle.event.code === this.layout.event.code) this.layout = bundle;
		} catch {
			return;
		}
	}

	async refreshAnalysis() {
		const version = this.signature;
		if (!this.replay || !this.#loadAnalysis || version === this.#version) return;
		this.#version = version;
		const request = ++this.#request;
		try {
			const analysis = await this.#loadAnalysis({
				code: this.layout.event.code,
				at: Math.round(this.clock),
				version
			});
			if (request === this.#request) this.analysis = analysis;
		} catch {
			if (request === this.#request) this.#version = null;
		}
	}

	check() {
		this.now = this.#clock();
		if (this.replay || !this.feed.bundle) return;
		if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
		const due = needsReload({
			shown: untrack(() => this.layout),
			latest: this.feed.bundle,
			analysis: untrack(() => this.analysis),
			now: this.now,
			lastReload: this.#lastReload
		});
		if (!due) return;
		this.#lastReload = this.now;
		this.#reload();
	}

	start(): () => void {
		const stop = this.feed.start();
		if (this.replay) untrack(() => void this.loadScores());
		const timer = setInterval(() => this.check(), this.replay ? REPLAY_TICK : LIVE_TICK);
		return () => {
			clearInterval(timer);
			stop();
		};
	}
}
