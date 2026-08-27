const FALLBACK_BAND_COLORS = { alta: "#16a34a", media: "#f59e0b", baja: "#9ca3af" };

export default function CompactRail({ results, selectedNodeId, onSelect, bandColors }) {
  const colors = bandColors || FALLBACK_BAND_COLORS;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Ranking ({results.length})
      </div>
      <ol className="flex flex-col gap-1">
        {results.map((r, i) => {
          const color = colors[r.relevance.label] || "#9ca3af";
          const selected = r.target.id === selectedNodeId;
          return (
            <li key={r.target.id}>
              <button
                type="button"
                onClick={() => onSelect(r.target.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                  selected ? "bg-indigo-950/50 ring-1 ring-indigo-500/50" : "hover:bg-slate-800/60"
                }`}
              >
                <span className="w-4 shrink-0 text-right font-mono text-slate-500">{i + 1}</span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: color }}
                  title={r.relevance.label}
                />
                <span className="flex-1 truncate font-mono text-slate-200">{r.target.id}</span>
                <span className="shrink-0 font-mono text-slate-400">
                  {r.relevance.score.toFixed(2)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
