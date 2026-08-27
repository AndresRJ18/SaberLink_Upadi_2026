import { useEffect, useRef, useState } from "react";
import { searchEntities } from "../api/client";

const ENTITY_TYPE_HINT = "Ej: NEED-001, PRJ-014, INV-032, GRP-009";

export default function SearchPanel({ onSubmit, loading }) {
  const [mode, setMode] = useState("id"); // "id" | "text"
  const [entityId, setEntityId] = useState("NEED-001");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [expectedImpact, setExpectedImpact] = useState("");
  const [topK, setTopK] = useState(8);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (mode !== "id" || !entityId.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchEntities({ q: entityId.trim(), limit: 6 });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [entityId, mode]);

  function handleSubmit(e) {
    e.preventDefault();
    setShowSuggestions(false);
    if (mode === "id") {
      if (!entityId.trim()) return;
      onSubmit({ entityId: entityId.trim(), topK });
    } else {
      if (!description.trim()) return;
      onSubmit({
        rawTextProfile: {
          title: title.trim() || description.trim().slice(0, 80),
          description: description.trim(),
          context: context.trim() || null,
          expected_impact: expectedImpact.trim() || null,
        },
        topK,
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <div className="flex gap-1 rounded-lg bg-slate-800/70 p-1 text-sm font-medium">
        {[
          { key: "id", label: "ID existente" },
          { key: "text", label: "Texto libre" },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMode(opt.key)}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              mode === opt.key
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "id" ? (
        <div className="relative">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            ID de entidad
          </label>
          <input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={ENTITY_TYPE_HINT}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={() => {
                      setEntityId(s.id);
                      setShowSuggestions(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-800"
                  >
                    <span className="font-mono text-indigo-300">
                      {s.id} <span className="text-slate-500">· {s.type_label}</span>
                    </span>
                    <span className="truncate text-xs text-slate-400">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Se trata como necesidad temporal — nunca se escribe en institutional_needs.csv.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Título
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Contexto (opcional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Impacto esperado (opcional)
            </label>
            <textarea
              value={expectedImpact}
              onChange={(e) => setExpectedImpact(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Resultados</span>
          <span className="font-mono text-slate-300">{topK}</span>
        </div>
        <input
          type="range"
          min={3}
          max={15}
          value={topK}
          onChange={(e) => setTopK(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Procesando en vivo…" : "Buscar conexiones"}
      </button>
    </form>
  );
}
