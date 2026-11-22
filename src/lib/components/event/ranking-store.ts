import { parseRankingChoice, rankingQuery, type RankingChoice } from './ranking-columns.ts';

const KEY = 'ps-rankings-view';

export function loadRankingChoice(): RankingChoice | null {
	try {
		const raw = localStorage.getItem(KEY);
		return raw === null ? null : parseRankingChoice(new URLSearchParams(raw));
	} catch {
		return null;
	}
}

export function saveRankingChoice(choice: RankingChoice): boolean {
	try {
		const query = rankingQuery(choice);
		if (query) localStorage.setItem(KEY, query.slice(1));
		else localStorage.removeItem(KEY);
		return true;
	} catch {
		return false;
	}
}
