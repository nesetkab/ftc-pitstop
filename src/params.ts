import { defineParams } from '@sveltejs/kit/params';

export const params = defineParams({
	team: (param) => (/^[1-9]\d{0,4}$/.test(param) ? Number(param) : undefined),
	page: (param) => (/^(?:api|og)(?:\/|$)/.test(param) ? undefined : param)
});
