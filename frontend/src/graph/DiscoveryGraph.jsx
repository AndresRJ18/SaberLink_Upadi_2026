import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";

cytoscape.use(fcose);

// Rough visual grouping of the 15 entity types into shapes, so the graph
// reads as categories at a glance instead of 15 flat colored dots.
const TYPE_SHAPES = {
  FAC: "hexagon",
  PRG: "hexagon",
  GRP: "hexagon",
  LIN: "hexagon",
  CAP: "hexagon",
  SRC: "hexagon",
  INV: "ellipse",
  EXP: "ellipse",
  SUB: "round-rectangle",
  COM: "round-rectangle",
  LO: "round-rectangle",
  NEED: "diamond",
  PRJ: "diamond",
  THS: "diamond",
  PUB: "diamond",
};

const ROLE_SIZE = { source: 64, result: 40, hub: 22 };
const BANDS = ["alta", "media", "baja"];

function toElements(graphData) {
  if (!graphData) return [];
  const nodes = graphData.nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.label,
      color: n.color,
      role: n.role,
      entityType: n.type,
      typeLabel: n.type_label,
      shape: TYPE_SHAPES[n.type] || "ellipse",
      size: ROLE_SIZE[n.role] || 30,
    },
  }));
  const edges = graphData.edges.map((e, i) => ({
    data: {
      id: `e${i}`,
      source: e.source,
      target: e.target,
      kind: e.kind,
      band: e.band || null,
      color: e.kind === "discovery" ? e.color : "#475569",
      label: e.kind === "discovery" ? e.label : "",
      inferred: !!e.inferred,
      tooltip: e.kind === "discovery" ? e.tooltip : e.relation,
    },
  }));
  return [...nodes, ...edges];
}

const STYLESHEET = [
  {
    selector: "node",
    style: {
      shape: "data(shape)",
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      label: "data(label)",
      color: "#e5e7eb",
      "font-size": 9,
      "text-wrap": "wrap",
      "text-max-width": "80px",
      "text-valign": "bottom",
      "text-margin-y": 4,
      "border-width": 0,
      "transition-property": "opacity",
      "transition-duration": 150,
    },
  },
  {
    selector: 'node[role = "source"]',
    style: { "border-width": 3, "border-color": "#f8fafc", "font-size": 12, "font-weight": 700 },
  },
  {
    selector: 'node[role = "hub"]',
    style: { "font-size": 7, opacity: 0.75 },
  },
  {
    selector: "node.selected",
    style: { "border-width": 4, "border-color": "#818cf8" },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "data(color)",
      "target-arrow-color": "data(color)",
      "curve-style": "bezier",
      opacity: 0.85,
    },
  },
  {
    selector: 'edge[kind = "discovery"]',
    style: {
      width: 3,
      "target-arrow-shape": "triangle",
      label: "data(label)",
      "font-size": 9,
      color: "#cbd5e1",
      "text-background-color": "#0b0e14",
      "text-background-opacity": 0.85,
      "text-background-padding": 2,
    },
  },
  {
    selector: 'edge[kind = "structural"]',
    style: { width: 1, "line-style": "solid" },
  },
  {
    // Boolean data fields need the "?field" truthy-check form — "[inferred = \"true\"]"
    // compares against the *string* "true" and silently never matches a real boolean.
    selector: "edge[?inferred]",
    style: { "line-style": "dashed" },
  },
  {
    selector: ".faded",
    style: { opacity: 0.12 },
  },
  {
    selector: ".hidden-band",
    style: { display: "none" },
  },
];

// A fresh layout object (new reference) is what tells react-cytoscapejs's
// own diff (patch.js: shallowObjDiff on the `layout` prop) to call
// cy.layout(...).run() again — recomputed only when the actual graph data
// changes, via the [elements] dependency, never on unrelated re-renders
// (e.g. toggling a band filter chip or selecting a node).
function useDiscoveryLayout(elements) {
  return useMemo(() => {
    if (elements.length === 0) return { name: "preset" };
    return {
      name: "fcose",
      animate: true,
      animationDuration: 400,
      randomize: true,
      fit: true,
      padding: 56,
      nodeDimensionsIncludeLabels: true,
      nodeRepulsion: 9000,
      idealEdgeLength: 110,
      quality: "default",
    };
  }, [elements]);
}

/**
 * Controlled by `selectedNodeId`/`onSelectNode` so the same selection can be
 * driven either by clicking a node here or a row in the rail list (App.jsx
 * owns the single source of truth). Clicking a node (or a rail row) both
 * fades non-neighbors here AND surfaces that node's detail in App's drawer.
 */
export default function DiscoveryGraph({ graphData, legend, selectedNodeId, onSelectNode }) {
  const cyRef = useRef(null);
  const [activeBands, setActiveBands] = useState(new Set(BANDS));
  const elements = useMemo(() => toElements(graphData), [graphData]);
  const layout = useDiscoveryLayout(elements);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.edges('[kind = "discovery"]').forEach((edge) => {
      const band = edge.data("band");
      edge.toggleClass("hidden-band", band && !activeBands.has(band));
    });
  }, [activeBands, elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("selected");
    if (!selectedNodeId) {
      cy.elements().removeClass("faded");
      return;
    }
    const node = cy.getElementById(selectedNodeId);
    if (node.empty()) return;
    node.addClass("selected");
    const neighborhood = node.closedNeighborhood();
    cy.elements().addClass("faded");
    neighborhood.removeClass("faded");
  }, [selectedNodeId, elements]);

  function toggleBand(band) {
    setActiveBands((prev) => {
      const next = new Set(prev);
      if (next.has(band)) next.delete(band);
      else next.add(band);
      return next;
    });
  }

  function handleCyInit(cy) {
    cyRef.current = cy;
    // react-cytoscapejs calls this `cy` prop on every mount AND every
    // update (see its componentDidMount/componentDidUpdate) — and, under
    // React.StrictMode in dev, the whole component mounts, unmounts, and
    // remounts once on its first appearance. Without this guard, tap
    // handlers would stack up (once per update) on whichever cy instance
    // survives. The guard is per-instance (cy.scratch), so a genuinely new
    // cy instance (after a StrictMode remount) still gets wired up once.
    if (cy.scratch("_saberlinkBound")) return;
    cy.scratch("_saberlinkBound", true);
    cy.on("tap", "node", (evt) => onSelectNode?.(evt.target.id()));
    cy.on("tap", (evt) => {
      if (evt.target === cy) onSelectNode?.(null);
    });
  }

  if (!graphData) {
    return (
      <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
        El grafo de descubrimiento aparece acá después de una búsqueda.
      </div>
    );
  }

  const bandColors = Object.fromEntries((legend?.score_bands || []).map((b) => [b.band, b.color]));
  const typeSwatches = legend?.entity_types || [];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {BANDS.map((band) => (
            <button
              key={band}
              onClick={() => toggleBand(band)}
              className="rounded-full px-2.5 py-1 text-xs font-semibold transition"
              style={{
                background: activeBands.has(band) ? `${bandColors[band] || "#9ca3af"}22` : "transparent",
                color: activeBands.has(band) ? bandColors[band] || "#9ca3af" : "#475569",
                border: `1px solid ${activeBands.has(band) ? bandColors[band] || "#9ca3af" : "#334155"}`,
              }}
            >
              {band}
            </button>
          ))}
        </div>
        <button
          onClick={() => cyRef.current?.fit(undefined, 40)}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Encuadrar todo
        </button>
      </div>

      <CytoscapeComponent
        elements={elements}
        stylesheet={STYLESHEET}
        layout={layout}
        style={{ width: "100%", height: "70vh", minHeight: "420px" }}
        cy={handleCyInit}
        wheelSensitivity={0.2}
      />

      {typeSwatches.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
          {typeSwatches.map((t) => (
            <span key={t.type} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: t.color }}
              />
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
