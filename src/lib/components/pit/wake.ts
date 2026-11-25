export function keepAwake(): () => void {
	let lock: WakeLockSentinel | null = null;
	let asking = false;
	let active = true;

	async function request() {
		if (!active || lock || asking || document.visibilityState !== 'visible') return;
		if (!('wakeLock' in navigator)) return;
		asking = true;
		try {
			const sentinel = await navigator.wakeLock.request('screen');
			if (!active) {
				await sentinel.release();
				return;
			}
			lock = sentinel;
			sentinel.addEventListener('release', () => {
				if (lock === sentinel) lock = null;
			});
		} catch {
			lock = null;
		} finally {
			asking = false;
		}
	}

	const retry = () => void request();
	document.addEventListener('visibilitychange', retry);
	document.addEventListener('pointerdown', retry);
	void request();

	return () => {
		active = false;
		document.removeEventListener('visibilitychange', retry);
		document.removeEventListener('pointerdown', retry);
		void lock?.release();
		lock = null;
	};
}
