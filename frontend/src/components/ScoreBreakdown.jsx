const SIGNAL_LABELS = {
  semantic: "Semántica",
  domain: "Dominio",
  method: "Método",
  structural: "Estructural",
};

const SIGNAL_COLORS = {
  semantic: "#818cf8",
  domain: "#22d3ee",
  method: "#facc15",
  structural: "#94a3b8",
};

export default function ScoreBreakdown({ breakdown, status }) {
  const keys = ["semantic", "domain", "method", "structural"];
  return (
    <div className="flex flex-col gap-1.5">
      {keys.map((key) => {
        const value = breakdown?.[key];
        const st = status?.[key];
        const na = st === "not_applicable" || st === "not_available" || value == null;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-slate-400">{SIGNAL_LABELS[key]}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              {!na && (
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(value * 100)}%`,
                    background: SIGNAL_COLORS[key],
                  }}
                />
              )}
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-slate-400">
              {na ? "n/d" : value.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
