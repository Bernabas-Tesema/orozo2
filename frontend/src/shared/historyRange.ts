export type HistoryRange = 'day' | 'week' | 'month' | 'year';

export const HISTORY_RANGES: Array<{ id: HistoryRange; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export function historyWindowMs(range: HistoryRange) {
  if (range === 'day') return 86_400_000;
  if (range === 'week') return 7 * 86_400_000;
  if (range === 'year') return 365 * 86_400_000;
  return 31 * 86_400_000;
}

export function inHistoryRange(iso: string | undefined, range: HistoryRange, now = Date.now()) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return now - time <= historyWindowMs(range) && time <= now;
}
