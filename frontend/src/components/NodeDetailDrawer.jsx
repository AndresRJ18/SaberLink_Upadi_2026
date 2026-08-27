import ScoreBreakdown from "./ScoreBreakdown";

const PRIORITY_COLORS = { alta: "#16a34a", media: "#f59e0b", baja: "#9ca3af" };
const FALLBACK_BAND_COLORS = { alta: "#16a34a", media: "#f59e0b", baja: "#9ca3af" };

function OpportunityCard({ o }) {
  const color = PRIORITY_COLORS[o.priority] || "#9ca3af";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
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
    </div>
  );
}

export default function NodeDetailDrawer({ selectedNodeId, queryResult, graphData, bandColors, onClose }) {
  const open = !!selectedNodeId;
  const colors = bandColors || FALLBACK_BAND_COLORS;

  const node = graphData?.nodes?.find((n) => n.id === selectedNodeId);
  const result = queryResult?.results?.find((r) => r.target.id === selectedNodeId);
  const isSource = selectedNodeId === queryResult?.source?.id;
  const relatedOpportunities =
    queryResult?.opportunities?.filter((o) => o.related_entities?.includes(selectedNodeId)) || [];

  // graphData (and so `node`) is only ever set for an official entity_id
  // query — a texto libre / PDF query has no persisted id to look up in
  // /graph, so its ranked results only exist in `result`. Falling back to
  // `result.target` keeps the drawer working in that case instead of
  // rendering nothing.
  const displayTypeLabel = node?.type_label || result?.target?.type || (isSource ? queryResult?.source?.type : "");
  const displayLabel = node?.label && node.label !== node.id ? node.label : null;

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-40 h-full w-full max-w-md transform overflow-y-auto border-l border-slate-800 bg-slate-950 p-5 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedNodeId && (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-lg font-bold text-slate-50">{selectedNodeId}</div>
                <div className="text-xs text-slate-500">{displayTypeLabel}</div>
                {displayLabel && <p className="mt-1 text-sm text-slate-300">{displayLabel}</p>}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
              >
                Cerrar ✕
              </button>
            </div>

            {isSource && (
              <div className="rounded-lg border border-indigo-900/50 bg-indigo-950/20 p-3 text-sm text-slate-300">
                Esta es la entidad consultada — el centro del grafo. Elegí cualquier otro nodo
                para ver por qué se conecta con ella.
                {queryResult?.meta && (
                  <p className="mt-2 text-xs text-slate-500">
                    {queryResult.meta.elapsed_seconds}s · {queryResult.meta.total_candidates_scored}{" "}
                    candidatos evaluados
                  </p>
                )}
              </div>
            )}

            {!isSource && result && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      background: `${colors[result.relevance.label] || "#9ca3af"}22`,
                      color: colors[result.relevance.label] || "#9ca3af",
                    }}
                  >
                    {result.relevance.label} · {result.relevance.score.toFixed(2)}
                  </span>
                </div>

                <ScoreBreakdown
                  breakdown={result.relevance.breakdown}
                  status={result.relevance.breakdown_status}
                />

                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Explicación
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                      texto generado
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{result.explanation}</p>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Evidencia — cadena de trazabilidad
                  </div>
                  {result.evidence.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin evidencia estructurada.</p>
                  ) : (
                    <ol className="flex flex-col gap-2">
                      {result.evidence.map((ev, i) => (
                        <li
                          key={i}
                          className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs"
                        >
                          <div className="mb-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-indigo-300">
                            <span>{ev.file}</span>
                            <span className="text-slate-600">/</span>
                            <span>{ev.id}</span>
                            <span className="text-slate-600">/</span>
                            <span>{ev.field}</span>
                          </div>
                          <p className="text-slate-300">{ev.snippet}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}

            {!isSource && !result && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
                Nodo puente estructural — no es una conexión rankeada directamente, aparece
                porque forma parte del camino en el grafo institucional que explica la
                cercanía de otra conexión.
              </div>
            )}

            {relatedOpportunities.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Oportunidades relacionadas
                </div>
                <div className="flex flex-col gap-3">
                  {relatedOpportunities.map((o, i) => (
                    <OpportunityCard key={i} o={o} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
