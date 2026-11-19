export function record(wins: number, losses: number, ties = 0): string {
	return `${wins}-${losses}-${ties}`;
}
