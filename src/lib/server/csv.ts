export function csvResponse(body: string, filename: string, cacheControl: string): Response {
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`,
			'cache-control': cacheControl
		}
	});
}
