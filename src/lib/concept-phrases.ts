import { tokenize } from "@/lib/text";
import type { Concept } from "@/lib/types";

// Extract contiguous wording: never discard negation or invent a summary.
export function conceptPhrase(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  const clauses = clean.split(/[。！？!?;；]|\.(?:\s|$)|[,，]/u).map(s => s.trim()).filter(Boolean);
  const candidates = clauses.filter(s => /[\p{L}\p{N}]/u.test(s));
  const score = (value: string) => {
    const han = /\p{Script=Han}/u.test(value);
    const complete = han ? Array.from(value).length <= 18 : value.split(/\s+/).length <= 8 && value.length <= 64;
    const conditional = /^(if|when|unless|although|and|then|not a|not to)\b|^(如果|假如|雖然|虽然)/i.test(value);
    return Math.min(5, new Set(tokenize(value).stems).size) + (complete ? 4 : 0) + (/\b(not|never|cannot|don.t|can.t|no)\b|不|無|无|未/i.test(value) ? 3 : 0) - (conditional ? 5 : 0);
  };
  const clause = candidates.reduce((best, value) => score(value) > score(best) ? value : best, candidates[0] ?? clean);
  const words = clause.split(/\s+/);
  const han = /\p{Script=Han}/u.test(clause);
  const limit = han ? 18 : 64;
  const excerpt = han ? clause : words.slice(0, 8).join(" ");
  const points = Array.from(excerpt);
  const shortened = points.length > limit ? points.slice(0, limit).join("").trimEnd() : excerpt;
  return shortened + (shortened.length < clause.length ? "…" : "");
}

export function phraseConcepts(items: {id:string; text:string}[], themeId: string | null = null, limit = 24): Concept[] {
  const groups = new Map<string, Concept>();
  for (const item of items) {
    const text = conceptPhrase(item.text);
    if (!text) continue;
    // Keep distinct longer statements separate even if their displayed prefixes match.
    const key = item.text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const existing = groups.get(key);
    if (existing) { existing.responseIds!.push(item.id); existing.weight += 1; }
    else groups.set(key, {text, weight:1, themeId, responseIds:[item.id]});
  }
  // Identical visible labels share a bubble, but retain every source response.
  const labels = new Map<string, Concept>();
  for (const concept of groups.values()) {
    const key = concept.text.toLocaleLowerCase();
    const existing = labels.get(key);
    if (existing) {existing.responseIds!.push(...concept.responseIds!);existing.weight += concept.weight;}
    else labels.set(key, concept);
  }
  return [...labels.values()].sort((a,b)=>b.weight-a.weight).slice(0,limit);
}
