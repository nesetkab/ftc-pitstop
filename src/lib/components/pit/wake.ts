export function keepAwake(): () => void {
	let lock: WakeLockSentinel | null = null;
	let active = true;

	async function request() {
		if (!active || lock || document.visibilityState !== 'visible') return;
		if (!('wakeLock' in navigator)) return;
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
