import { teamManifest } from '#lib/components/pit/manifest.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) =>
	new Response(JSON.stringify(teamManifest(params.team)), {
		headers: {
			'content-type': 'application/manifest+json',
			'cache-control': 'public, max-age=3600, s-maxage=86400'
		}
	});
