const PRIORITY_COLORS = { alta: "#16a34a", media: "#f59e0b", baja: "#9ca3af" };

export default function OpportunityList({ opportunities }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        Oportunidades generadas
      </div>
      {opportunities.length === 0 ? (
        <p className="text-sm text-slate-500">Ninguna regla disparó para esta consulta.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {opportunities.map((o, i) => {
            const color = PRIORITY_COLORS[o.priority] || "#9ca3af";
            return (
              <li key={i} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    {o.type}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${color}22`, color }}
                  >
                    prioridad {o.priority}
                  </span>
                </div>
                <p className="text-sm text-slate-200">{o.opportunity}</p>
                <p className="mt-1 text-xs text-slate-500">razón: {o.reason}</p>
                {o.related_entities?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {o.related_entities.map((eid) => (
                      <span
                        key={eid}
                        className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
                      >
                        {eid}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
