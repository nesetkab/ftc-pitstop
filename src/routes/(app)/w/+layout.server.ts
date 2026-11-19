import { sharedWorkspaces } from '#lib/workspace/shared.server.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({ shared: sharedWorkspaces() });
