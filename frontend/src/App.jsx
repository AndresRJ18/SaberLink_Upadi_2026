import { useEffect, useState } from "react";
import { apiErrorMessage, fetchGraph, fetchLegend, runQuery } from "./api/client";
import DetailPanel from "./components/DetailPanel";
import OpportunityList from "./components/OpportunityList";
import ResultCard from "./components/ResultCard";
import SearchPanel from "./components/SearchPanel";
import DiscoveryGraph from "./graph/DiscoveryGraph";

export default function App() {
  const [legend, setLegend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    fetchLegend().then(setLegend).catch(() => setLegend(null));
  }, []);

  async function handleSearch({ entityId, rawTextProfile, topK }) {
    setLoading(true);
    setError(null);
    setGraphData(null);
    try {
      const result = await runQuery({ entityId, rawTextProfile, topK });
      setQueryResult(result);
      setSelectedIndex(0);

      // /graph only supports existing entity_id — a raw_text_profile query
      // mints a fresh TEMP-xxxxxxxx id each call that can't be looked up a
      // second time (same constraint pyvis_export documents).
      if (result.source.official) {
        try {
          const graph = await fetchGraph({ entityId: result.source.id, topK });
          setGraphData(graph);
        } catch {
          setGraphData(null);
        }
      }
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
  const selectedResult = queryResult?.results?.[selectedIndex] || null;

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <header className="border-b border-slate-800 bg-slate-950/60 px-6 py-5">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold tracking-tight text-slate-50">
            SaberLink <span className="font-normal text-slate-500">— Knowledge Nexus LATAM</span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Dado un ID de necesidad institucional (o cualquier entidad), descubre conexiones,
            las prioriza con evidencia trazable y genera una oportunidad accionable — en vivo,
            sobre consultas nuevas.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SearchPanel onSubmit={handleSearch} loading={loading} />
          </aside>

          <section className="flex flex-col gap-6">
            {error && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {!queryResult && !error && (
              <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">
                Buscá un ID existente o describí una necesidad nueva para empezar.
              </div>
            )}

            {queryResult && (
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
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Conexiones descubiertas
                    </h2>
                    {queryResult.results.map((r, i) => (
                      <ResultCard
                        key={r.target.id}
                        result={r}
                        index={i}
                        selected={i === selectedIndex}
                        onSelect={() => setSelectedIndex(i)}
                        bandColors={bandColors}
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-6">
                    <DetailPanel result={selectedResult} />
                    <OpportunityList opportunities={queryResult.opportunities} />
                  </div>
                </div>

                <div>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Grafo de descubrimiento
                  </h2>
                  <DiscoveryGraph graphData={graphData} legend={legend} />
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-600">
          Sin LLM en el pipeline — embeddings (sentence-transformers), grafo (networkx) y
          scoring/oportunidades en Python propio. Sin cloud deploy, corre local.
        </footer>
      </main>
    </div>
  );
}
