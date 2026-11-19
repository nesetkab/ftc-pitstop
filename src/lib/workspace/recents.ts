import { CODE_PATTERN } from '#lib/workspace/code.ts';
import type { StorageLike } from '#lib/workspace/device-store.ts';
import type { WorkspaceKind } from '#lib/workspace/types.ts';

export interface Recent {
	code: string;
	teamNumber: number | null;
	kind: WorkspaceKind;
	openedAt: number;
}

const RECENTS_KEY = 'ps-workspaces';
const INITIALS_KEY = 'ps-initials';
const LINKS_KEY = 'ps-links';
const MAX_RECENTS = 8;

function readJson(storage: StorageLike, key: string): unknown {
	try {
		const raw = storage.getItem(key);
		return raw === null ? null : JSON.parse(raw);
	} catch {
		return null;
	}
}

function writeJson(storage: StorageLike, key: string, value: unknown) {
	try {
		storage.setItem(key, JSON.stringify(value));
	} catch {
		return;
	}
}

function isRecent(value: unknown): value is Recent {
	if (typeof value !== 'object' || value === null) return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.code === 'string' &&
		CODE_PATTERN.test(item.code) &&
		(item.teamNumber === null || Number.isInteger(item.teamNumber)) &&
		(item.kind === 'device' || item.kind === 'shared' || item.kind === 'memory') &&
		typeof item.openedAt === 'number'
	);
}

export function readRecents(storage: StorageLike): Recent[] {
	const value = readJson(storage, RECENTS_KEY);
	return Array.isArray(value) ? value.filter(isRecent) : [];
}

export function rememberRecent(storage: StorageLike, recent: Recent): Recent[] {
	const next = [recent, ...readRecents(storage).filter((item) => item.code !== recent.code)].slice(
		0,
		MAX_RECENTS
	);
	writeJson(storage, RECENTS_KEY, next);
	return next;
}

export function forgetRecent(storage: StorageLike, code: string): Recent[] {
	const next = readRecents(storage).filter((item) => item.code !== code);
	writeJson(storage, RECENTS_KEY, next);
	return next;
}

export function normalizeInitials(input: string): string {
	return input
		.replace(/[^a-z0-9]/gi, '')
		.toUpperCase()
		.slice(0, 3);
}

export function readInitials(storage: StorageLike): string {
	try {
		return normalizeInitials(storage.getItem(INITIALS_KEY) ?? '');
	} catch {
		return '';
	}
}

export function saveInitials(storage: StorageLike, input: string): string {
	const initials = normalizeInitials(input);
	try {
		if (initials) storage.setItem(INITIALS_KEY, initials);
		else storage.removeItem(INITIALS_KEY);
	} catch {
		return initials;
	}
	return initials;
}

export function readLinked(storage: StorageLike, from: string): string | null {
	const value = readJson(storage, LINKS_KEY);
	if (typeof value !== 'object' || value === null) return null;
	const code = (value as Record<string, unknown>)[from];
	return typeof code === 'string' && CODE_PATTERN.test(code) ? code : null;
}

export function rememberLinked(storage: StorageLike, from: string, code: string) {
	const value = readJson(storage, LINKS_KEY);
	const links =
		typeof value === 'object' && value !== null ? (value as Record<string, string>) : {};
	writeJson(storage, LINKS_KEY, { ...links, [from]: code });
}
