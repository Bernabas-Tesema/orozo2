import { HISTORY_RANGES, HistoryRange } from '../historyRange';

export function HistoryRangeControl({
  value,
  onChange,
  tone = 'light',
}: {
  value: HistoryRange;
  onChange: (range: HistoryRange) => void;
  tone?: 'light' | 'dark';
}) {
  return (
    <div
      className={
        tone === 'dark'
          ? 'inline-flex rounded-2xl border border-white/15 bg-white/10 p-1'
          : 'inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm'
      }
      role="group"
      aria-label="History period"
    >
      {HISTORY_RANGES.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
              selected
                ? tone === 'dark'
                  ? 'bg-white text-slate-900'
                  : 'bg-slate-900 text-white'
                : tone === 'dark'
                  ? 'text-white/80 hover:bg-white/10'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
