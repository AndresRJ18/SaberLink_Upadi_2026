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

const ROLE_SIZE = { source: 60, result: 36, hub: 16 };
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
      color: e.kind === "discovery" ? e.color : "#8a92a6",
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
      color: "#ece4d3",
      "font-family": "Newsreader, ui-serif, Georgia, serif",
      "font-style": "italic",
      "font-size": 9.5,
      "text-wrap": "wrap",
      "text-max-width": "86px",
      "text-valign": "bottom",
      "text-margin-y": 5,
      "text-outline-width": 2,
      "text-outline-color": "#090d16",
      "text-outline-opacity": 0.85,
      "border-width": 1,
      "border-color": "#090d16",
      "border-opacity": 0.6,
      "shadow-blur": 14,
      "shadow-color": "data(color)",
      "shadow-opacity": 0.5,
      "shadow-offset-x": 0,
      "shadow-offset-y": 0,
      "transition-property": "opacity",
      "transition-duration": 150,
    },
  },
  {
    selector: 'node[role = "source"]',
    style: {
      "border-width": 2.5,
      "border-color": "#f0d9a3",
      "border-opacity": 0.9,
      "font-style": "normal",
      "font-weight": 600,
      "font-size": 13,
      "shadow-blur": 32,
      "shadow-opacity": 0.85,
    },
  },
  {
    selector: 'node[role = "hub"]',
    style: { "font-size": 7.5, opacity: 0.7, "shadow-blur": 6, "shadow-opacity": 0.3 },
  },
  {
    selector: "node.selected",
    style: { "border-width": 3, "border-color": "#f0d9a3", "border-opacity": 1, "shadow-blur": 30 },
  },
  {
    selector: "edge",
    style: {
      width: 1.1,
      "line-color": "data(color)",
      "target-arrow-color": "data(color)",
      "curve-style": "bezier",
      opacity: 0.7,
    },
  },
  {
    selector: 'edge[kind = "discovery"]',
    style: {
      width: 2.4,
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      opacity: 0.9,
      label: "data(label)",
      "font-family": "IBM Plex Mono, monospace",
      "font-size": 9,
      color: "#f0d9a3",
      "text-background-color": "#090d16",
      "text-background-opacity": 0.9,
      "text-background-padding": 2,
      "shadow-blur": 8,
      "shadow-color": "data(color)",
      "shadow-opacity": 0.45,
    },
  },
  {
    selector: 'edge[kind = "structural"]',
    style: { width: 0.75, "line-color": "#8a92a6", opacity: 0.35 },
  },
  {
    // Boolean data fields need the "?field" truthy-check form — "[inferred = \"true\"]"
    // compares against the *string* "true" and silently never matches a real boolean.
    selector: "edge[?inferred]",
    style: { "line-style": "dashed", "line-dash-pattern": [2, 3] },
  },
  {
    selector: ".faded",
    style: { opacity: 0.08 },
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
      animationDuration: 500,
      randomize: true,
      fit: true,
      padding: 64,
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
      <div className="relative flex h-[70vh] min-h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-gold-500/10 bg-ink-900/40">
        <p className="font-body text-sm italic text-parchment-200/40">
          El grafo de descubrimiento aparece acá después de una búsqueda.
        </p>
      </div>
    );
  }

  const bandColors = Object.fromEntries((legend?.score_bands || []).map((b) => [b.band, b.color]));
  const typeSwatches = legend?.entity_types || [];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold-500/15 bg-ink-900/60 p-4">
      {/* Ambient aura behind the canvas — pure CSS, no per-frame cost. */}
      <div
        className="glow-pulse pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(204,159,69,0.14), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {BANDS.map((band) => (
            <button
              key={band}
              onClick={() => toggleBand(band)}
              className="rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold transition"
              style={{
                background: activeBands.has(band) ? `${bandColors[band] || "#7d8798"}1a` : "transparent",
                color: activeBands.has(band) ? bandColors[band] || "#7d8798" : "#4a5468",
                border: `1px solid ${activeBands.has(band) ? bandColors[band] || "#7d8798" : "#1a2136"}`,
              }}
            >
              {band}
            </button>
          ))}
        </div>
        <button
          onClick={() => cyRef.current?.fit(undefined, 40)}
          className="rounded-lg border border-ink-600 px-2.5 py-1 font-display text-xs font-medium text-parchment-200/60 transition hover:border-gold-500/40 hover:text-gold-400"
        >
          Encuadrar todo
        </button>
      </div>

      <CytoscapeComponent
        elements={elements}
        stylesheet={STYLESHEET}
        layout={layout}
        style={{ width: "100%", height: "70vh", minHeight: "420px", position: "relative" }}
        cy={handleCyInit}
        wheelSensitivity={0.2}
      />

      {typeSwatches.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gold-500/10 pt-3 font-mono text-[10.5px] text-parchment-200/45">
          {typeSwatches.map((t) => (
            <span key={t.type} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: t.color, boxShadow: `0 0 4px ${t.color}` }}
              />
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
