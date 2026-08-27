import { useEffect, useState } from "react";
import { apiErrorMessage, fetchGraph, fetchLegend, queryPdf, runQuery } from "./api/client";
import CompactRail from "./components/CompactRail";
import NodeDetailDrawer from "./components/NodeDetailDrawer";
import SearchPanel from "./components/SearchPanel";
import DiscoveryGraph from "./graph/DiscoveryGraph";

export default function App() {
  const [legend, setLegend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  useEffect(() => {
    fetchLegend().then(setLegend).catch(() => setLegend(null));
  }, []);

  async function afterResult(result, topK) {
    setQueryResult(result);
    setSelectedNodeId(null);
    setGraphData(null);

    // /graph only supports existing entity_id — a raw_text_profile or PDF
    // query mints a fresh TEMP-xxxxxxxx id each call that can't be looked
    // up a second time (same constraint pyvis_export documents).
    if (result.source.official) {
      try {
        const graph = await fetchGraph({ entityId: result.source.id, topK });
        setGraphData(graph);
      } catch {
        setGraphData(null);
      }
    }
  }

  async function handleSearch({ entityId, rawTextProfile, pdfFile, topK }) {
    setLoading(true);
    setError(null);
    setGraphData(null);
    try {
      const result = pdfFile
        ? await queryPdf({ file: pdfFile, topK })
        : await runQuery({ entityId, rawTextProfile, topK });
      await afterResult(result, topK);
    } catch (err) {
      setError(apiErrorMessage(err));
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  }

  const bandColors = Object.fromEntries(
    (legend?.score_bands || []).map((b) => [b.band, b.color])
  );

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <header className="border-b border-slate-800 bg-slate-950/60 px-6 py-5">
        <div className="mx-auto max-w-[1600px]">
          <h1 className="text-xl font-bold tracking-tight text-slate-50">
            SaberLink <span className="font-normal text-slate-500">— Knowledge Nexus LATAM</span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Dado un ID de necesidad institucional, texto libre o un PDF, descubre conexiones en
            vivo. Elegí cualquier nodo del grafo para ver su score, explicación y evidencia.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <SearchPanel onSubmit={handleSearch} loading={loading} />
            {queryResult && (
              <CompactRail
                results={queryResult.results}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
                bandColors={bandColors}
              />
            )}
          </aside>

          <section className="flex flex-col gap-4">
            {error && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {!queryResult && !error && !loading && (
              <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">
                Buscá un ID, describí una necesidad o subí un PDF para ver la red de conexiones.
              </div>
            )}

            {loading && (
              <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                Procesando en vivo — sin resultados precargados…
              </div>
            )}

            {queryResult && !loading && (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-xs text-slate-400">
                  <span className="font-mono text-slate-200">
                    {queryResult.source.id} <span className="text-slate-500">({queryResult.source.type})</span>
                  </span>
                  {!queryResult.source.official && (
                    <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      necesidad temporal, no persistida
                    </span>
                  )}
                  <span>{queryResult.meta.elapsed_seconds}s</span>
                  <span>{queryResult.meta.total_candidates_scored} candidatos evaluados</span>
                  <span className="ml-auto text-slate-500">
                    Click en un nodo para ver su detalle →
                  </span>
                </div>

                {graphData ? (
                  <DiscoveryGraph
                    graphData={graphData}
                    legend={legend}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                  />
                ) : (
                  <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                    Sin grafo disponible para esta consulta temporal.
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-600">
          Sin LLM en el pipeline — embeddings (sentence-transformers), grafo (networkx) y
          scoring/oportunidades en Python propio. Sin cloud deploy, corre local.
        </footer>
      </main>

      <NodeDetailDrawer
        selectedNodeId={selectedNodeId}
        queryResult={queryResult}
        graphData={graphData}
        bandColors={bandColors}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
