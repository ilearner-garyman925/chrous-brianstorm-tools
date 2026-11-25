import type { Concept } from "./types";

/** Stable hottest-first selection; weights use the cloud's supporter counts. */
export function hottestConcepts(concepts: Concept[], limit: number) {
  return [...concepts].sort((a, b) => b.weight - a.weight || `${a.text}:${a.themeId ?? ""}`.localeCompare(`${b.text}:${b.themeId ?? ""}`))
    .slice(0, Math.max(0, Math.min(concepts.length, Math.floor(limit))));
}

export function limitConceptsByLayer(concepts: Concept[], limits: ReadonlyMap<string | null, number>) {
  return [...new Set(concepts.map(item => item.themeId))].flatMap(id => {
    const layer = concepts.filter(item => item.themeId === id);
    return hottestConcepts(layer, Math.max(1, limits.get(id) ?? layer.length));
  });
}
