export default function DetailPanel({ result }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
        Seleccioná una conexión para ver su explicación y evidencia.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
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
          <p className="text-xs text-slate-500">Sin evidencia estructurada para esta conexión.</p>
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
  );
}
