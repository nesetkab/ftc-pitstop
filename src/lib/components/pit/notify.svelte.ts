import {
	ALERT_KEY,
	DEFAULT_ALERTS,
	TEST_ALERT,
	VIBRATE_KEY,
	VIBRATION,
	alertSnapshot,
	alertsBetween,
	parseAlertSettings,
	type AlertKey,
	type AlertSettings,
	type AlertSnapshot,
	type PitAlert
} from './alerts.ts';
import type { PitView } from './view.ts';

export type Permission = NotificationPermission | 'unsupported';

export class PitAlerts {
	settings = $state<AlertSettings>({ ...DEFAULT_ALERTS });
	permission = $state<Permission>('default');
	vibrate = $state(true);
	canVibrate = $state(false);

	#snapshot: AlertSnapshot | null = null;
	#sent = new Set<string>();

	load() {
		this.permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
		this.canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
		try {
			this.settings = parseAlertSettings(localStorage.getItem(ALERT_KEY));
			this.vibrate = localStorage.getItem(VIBRATE_KEY) !== 'off';
		} catch {
			this.settings = { ...DEFAULT_ALERTS };
		}
	}

	setVibrate(on: boolean) {
		this.vibrate = on;
		if (on) this.#buzz();
		try {
			localStorage.setItem(VIBRATE_KEY, on ? 'on' : 'off');
		} catch {
			return;
		}
	}

	test() {
		this.#buzz();
		void this.#show(TEST_ALERT);
	}

	get enabled(): boolean {
		return this.permission === 'granted' && Object.values(this.settings).some(Boolean);
	}

	get blocked(): boolean {
		return this.permission === 'denied' || this.permission === 'unsupported';
	}

	async set(key: AlertKey, on: boolean) {
		if (on && this.permission === 'default') {
			try {
				this.permission = await Notification.requestPermission();
			} catch {
				this.permission = 'denied';
			}
		}
		this.settings = { ...this.settings, [key]: on && this.permission === 'granted' };
		try {
			localStorage.setItem(ALERT_KEY, JSON.stringify(this.settings));
		} catch {
			return;
		}
	}

	observe(view: PitView, timeZone: string, now: number): PitAlert[] {
		const snapshot = alertSnapshot(view);
		const alerts = alertsBetween(this.#snapshot, snapshot, this.settings, timeZone, now).filter(
			(alert) => !this.#sent.has(alert.id)
		);
		this.#snapshot = snapshot;
		for (const alert of alerts) {
			this.#sent.add(alert.id);
			void this.#show(alert);
		}
		if (alerts.length > 0 && this.permission === 'granted') this.#buzz();
		return alerts;
	}

	reset() {
		this.#snapshot = null;
	}

	#buzz() {
		if (!this.vibrate || !this.canVibrate) return;
		try {
			navigator.vibrate(VIBRATION);
		} catch {
			return;
		}
	}

	async #show(alert: PitAlert) {
		if (this.permission !== 'granted') return;
		const options: NotificationOptions & { vibrate?: number[] } = {
			body: alert.body,
			tag: alert.id,
			icon: '/icons/icon-192.png',
			...(this.vibrate ? { vibrate: VIBRATION } : {})
		};
		try {
			const registration = await navigator.serviceWorker?.getRegistration();
			if (registration) await registration.showNotification(alert.title, options);
			else new Notification(alert.title, options);
		} catch {
			return;
		}
	}
}
