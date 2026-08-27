import ScoreBreakdown from "./ScoreBreakdown";

const FALLBACK_BAND_COLORS = { alta: "#16a34a", media: "#f59e0b", baja: "#9ca3af" };

export default function ResultCard({ result, index, selected, onSelect, bandColors }) {
  const colors = bandColors || FALLBACK_BAND_COLORS;
  const band = result.relevance.label;
  const color = colors[band] || "#9ca3af";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/40"
          : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-400">
            {index + 1}
          </span>
          <div>
            <div className="font-mono text-sm font-semibold text-slate-100">
              {result.target.id}
            </div>
            <div className="text-xs text-slate-500">{result.target.type}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: `${color}22`, color }}
          >
            {band} · {result.relevance.score.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <ScoreBreakdown
          breakdown={result.relevance.breakdown}
          status={result.relevance.breakdown_status}
        />
      </div>
    </button>
  );
}
