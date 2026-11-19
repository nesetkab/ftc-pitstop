import { defineParams } from '@sveltejs/kit/params';

export const params = defineParams({
	team: (param) => (/^[1-9]\d{0,5}$/.test(param) ? Number(param) : undefined)
});
