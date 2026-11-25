import { phraseConcepts } from "@/lib/concept-phrases";
import type { Concept, GroupDraft, Tension } from "@/lib/types";
import {
  prettyPhrase,
  promptStemSet,
  tokenize,
  type Tokens,
} from "@/lib/text";

type Item = { id: string; text: string; index: number };
type Doc = Item & Tokens;

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [key, value] of small) {
    const other = large.get(key);
    if (other) dot += value * other;
  }
  let left = 0;
  let right = 0;
  for (const value of a.values()) left += value * value;
  for (const value of b.values()) right += value * value;
  if (left === 0 || right === 0) return 0;
  return dot / Math.sqrt(left * right);
}

function jaccard(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size === 0 && right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

function buildDocs(prompt: string, items: Item[]) {
  const promptStems = promptStemSet(prompt);
  const docs: Doc[] = items.map((item) => ({ ...item, ...tokenize(item.text) }));
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set([...doc.stems, ...doc.bigrams])) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const total = docs.length;
  const idf = (term: string) => Math.log((total + 1) / ((df.get(term) ?? 0) + 1)) + 1;
  const vectors = docs.map((doc) => {
    const counts = new Map<string, number>();
    for (const stem of doc.stems) counts.set(stem, (counts.get(stem) ?? 0) + 1);
    for (const bigram of doc.bigrams) counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    const vector = new Map<string, number>();
    for (const [term, count] of counts) {
      let weight = (1 + Math.log(count)) * idf(term);
      if (term.split(" ").some((part) => promptStems.has(part))) weight *= 0.18;
      if (weight > 0) vector.set(term, weight);
    }
    return vector;
  });
  return { docs, vectors, promptStems, df };
}

function similarity(
  vectors: Map<string, number>[],
  docs: Doc[],
  left: number,
  right: number,
): number {
  return (
    0.72 * cosine(vectors[left]!, vectors[right]!) +
    0.28 * jaccard(docs[left]!.stems, docs[right]!.stems)
  );
}

function targetCount(size: number): number {
  if (size <= 1) return 1;
  if (size <= 4) return 2;
  if (size <= 8) return 3;
  return Math.max(3, Math.min(6, Math.round(Math.sqrt(size / 1.55))));
}

function clusterIndexes(docs: Doc[], vectors: Map<string, number>[]): number[][] {
  const cache = new Map<string, number>();
  const sim = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const value = similarity(vectors, docs, a, b);
    cache.set(key, value);
    return value;
  };
  const average = (left: number[], right: number[]) => {
    let total = 0;
    for (const a of left) for (const b of right) total += sim(a, b);
    return total / (left.length * right.length);
  };

  let groups = docs.map((_, index) => [index]);
  const target = targetCount(docs.length);
  const cap = 8;

  while (groups.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let best = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const score = average(groups[i]!, groups[j]!);
        const leftSize = groups[i]!.length + groups[j]!.length;
        const bestSize = groups[bestI]!.length + groups[bestJ]!.length;
        const better =
          score > best + 1e-9 ||
          (Math.abs(score - best) <= 1e-9 &&
            (leftSize < bestSize || (leftSize === bestSize && i < bestI)));
        if (better) {
          best = score;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (best < 0.07 && groups.length <= cap) break;
    if (groups.length <= target) break;
    const merged = groups[bestI]!.concat(groups[bestJ]!);
    groups = groups.filter((_, index) => index !== bestI && index !== bestJ);
    groups.push(merged);
  }

  return groups;
}

function surfaceFor(term: string, members: Doc[]): string {
  const counts = new Map<string, number>();
  const bigram = term.includes(" ");
  for (const doc of members) {
    const keys = bigram ? doc.bigrams : doc.stems;
    const labels = bigram ? doc.bigramSurfaces : doc.surfaces;
    keys.forEach((key, index) => {
      if (key !== term) return;
      const label = labels[index] ?? term;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
  }
  let best = term;
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return prettyPhrase(best);
}

function rankedTerms(
  members: Doc[],
  vectors: Map<string, number>[],
  indexes: number[],
  promptStems: Set<string>,
): { term: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const index of indexes) {
    for (const [term, weight] of vectors[index]!) {
      if (term.split(" ").some((part) => promptStems.has(part))) continue;
      scores.set(term, (scores.get(term) ?? 0) + weight);
    }
  }
  return [...scores.entries()]
    .map(([term, score]) => ({ term, score }))
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
}

function labelFor(
  terms: { term: string; score: number }[],
  members: Doc[],
): { label: string; keywords: string[] } {
  const unigrams = terms.filter((term) => !term.term.includes(" "));
  const bigrams = terms.filter((term) => term.term.includes(" "));
  const keywords = unigrams
    .slice(0, 4)
    .map((term) => surfaceFor(term.term, members));
  const topUni = unigrams[0];
  const secondUni = unigrams[1];
  const topBi = bigrams[0];
  let label = "A separate point";
  if (members.length === 1 && topUni) {
    const specific = [...unigrams.slice(0, 3)].sort(
      (a, b) => b.term.length - a.term.length || b.score - a.score,
    )[0];
    label = specific ? surfaceFor(specific.term, members) : label;
  } else if (topBi && topUni && topBi.score >= topUni.score * 0.78) {
    label = surfaceFor(topBi.term, members);
  } else if (topUni && secondUni && secondUni.score >= topUni.score * 0.52) {
    label = `${surfaceFor(topUni.term, members)} & ${surfaceFor(secondUni.term, members)}`;
  } else if (topUni) {
    label = surfaceFor(topUni.term, members);
  }
  return { label, keywords: [...new Set(keywords)].slice(0, 4) };
}

function medoid(indexes: number[], sim: (a: number, b: number) => number): number {
  if (indexes.length === 1) return indexes[0]!;
  let best = indexes[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of indexes) {
    let total = 0;
    for (const other of indexes) if (other !== candidate) total += sim(candidate, other);
    const score = total / (indexes.length - 1);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function clipQuote(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 220) return clean;
  return `${clean.slice(0, 217).trimEnd()}…`;
}

const RESTRICT =
  /should not allow|shouldn't allow|do not allow|don't allow|not allowed|laptop shut|less often|no[-\s]?ai|prohibit/i;
const PERMIT = /don't ban|do not ban|\ballow it\b|let us use|as long as we/i;

function polarityTension(docs: Doc[]): Tension | null {
  const restrict: string[] = [];
  const permit: string[] = [];
  const both: string[] = [];
  for (const doc of docs) {
    const left = RESTRICT.test(doc.text);
    const right = PERMIT.test(doc.text);
    if (left && right) both.push(doc.id);
    else if (left) restrict.push(doc.id);
    else if (right) permit.push(doc.id);
  }
  if (restrict.length < 2 || permit.length < 2) return null;
  const placements = [
    ...restrict.map((responseId) => ({ responseId, position: 0.1 })),
    ...both.map((responseId) => ({ responseId, position: 0.5 })),
    ...permit.map((responseId) => ({ responseId, position: 0.9 })),
  ];
  return {
    id: "tn_polarity",
    label: "How open should the rule be?",
    leftLabel: "Keep it out",
    rightLabel: "Let it in",
    summary:
      "Some responses argue for keeping the tool out of the work, or using it less. Others argue for letting it in under a condition they can live with.",
    placements,
  };
}

function scaleConcepts(concepts: Concept[], limit: number): Concept[] {
  const merged = new Map<string, Concept>();
  for (const concept of concepts) {
    const key = concept.text.toLowerCase();
    const existing = merged.get(key);
    if (!existing || concept.weight > existing.weight) merged.set(key, { ...concept });
  }
  const list = [...merged.values()].sort(
    (a, b) => b.weight - a.weight || a.text.localeCompare(b.text),
  );
  const sliced = list.slice(0, limit);
  const max = sliced[0]?.weight ?? 1;
  return sliced.map((concept) => ({
    ...concept,
    weight: Math.max(2, Math.round((concept.weight / max) * 10)),
  }));
}

export function liveConcepts(
  prompt: string,
  items: { id: string; text: string }[],
): Concept[] {
  void prompt;
  return phraseConcepts(items);
}

export function groupLocally(
  prompt: string,
  source: { id: string; text: string }[],
): GroupDraft {
  const items: Item[] = source.map((item, index) => ({ ...item, index }));
  if (items.length === 0) {
    return {
      overview: "No visible responses to group yet.",
      themes: [],
      tensions: [],
      followUps: [],
      concepts: [],
      responseCount: 0,
    };
  }

  const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const { docs, vectors, promptStems } = buildDocs(prompt, ordered);
  const groups = clusterIndexes(docs, vectors).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const aId = docs[Math.min(...a)]?.id ?? "";
    const bId = docs[Math.min(...b)]?.id ?? "";
    return aId.localeCompare(bId);
  });

  const simCache = new Map<string, number>();
  const sim = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const cached = simCache.get(key);
    if (cached !== undefined) return cached;
    const value = similarity(vectors, docs, a, b);
    simCache.set(key, value);
    return value;
  };

  const themes = groups.map((indexes, themeIndex) => {
    const members = indexes.map((index) => docs[index]!);
    const terms = rankedTerms(members, vectors, indexes, promptStems);
    const { label, keywords } = labelFor(terms, members);
    const quote = docs[medoid(indexes, sim)]!;
    const responseIds = members.map((doc) => doc.id).sort((a, b) => a.localeCompare(b));
    const summary =
      members.length === 1
        ? clipQuote(quote.text)
        : `${members.length} responses circle this. One way it was said: “${clipQuote(quote.text)}”`;
    return {
      id: `th_${themeIndex}`,
      label,
      summary,
      keywords,
      responseIds,
      terms,
      members,
      indexes,
    };
  });

  const concepts = themes.flatMap(theme => phraseConcepts(theme.members, theme.id, 4));

  const tensions: Tension[] = [];
  const polarity = polarityTension(docs);
  if (polarity) tensions.push(polarity);

  const sizable = themes.filter((theme) => theme.responseIds.length >= 2);
  let bestPair: [number, number, number] | null = null;
  for (let i = 0; i < sizable.length; i += 1) {
    for (let j = i + 1; j < sizable.length; j += 1) {
      const left = centroid(sizable[i]!.indexes, vectors);
      const right = centroid(sizable[j]!.indexes, vectors);
      const score = cosine(left, right);
      if (!bestPair || score < bestPair[2]) bestPair = [i, j, score];
    }
  }
  if (bestPair && bestPair[2] < 0.22 && tensions.length < 2) {
    const left = sizable[bestPair[0]]!;
    const right = sizable[bestPair[1]]!;
    const leftCentroid = centroid(left.indexes, vectors);
    const rightCentroid = centroid(right.indexes, vectors);
    const placements = [...left.indexes, ...right.indexes].map((index) => {
      const towardLeft = cosine(vectors[index]!, leftCentroid);
      const towardRight = cosine(vectors[index]!, rightCentroid);
      const position = towardRight / (Math.abs(towardLeft) + Math.abs(towardRight) || 1);
      return {
        responseId: docs[index]!.id,
        position: Math.min(0.95, Math.max(0.05, position)),
      };
    });
    tensions.push({
      id: "tn_themes",
      label: `Between ${left.label} and ${right.label}`,
      leftLabel: left.label,
      rightLabel: right.label,
      summary: `The room is pulled between “${left.label}” and “${right.label}”. They share little wording, so they may be different bets rather than one idea.`,
      placements,
    });
  }

  const largest = themes[0];
  const threaded = themes.filter((theme) => theme.responseIds.length > 1).length;
  const solos = themes.length - threaded;
  let overview = `${items.length} response${items.length === 1 ? "" : "s"}`;
  if (largest && threaded > 0) {
    overview += `, gathered into ${threaded} thread${threaded === 1 ? "" : "s"}. The largest is “${largest.label}”.`;
  } else {
    overview += ". Each one is standing on its own so far.";
  }
  if (solos > 0) {
    overview += ` ${solos} ${solos === 1 ? "voice sits" : "voices sit"} apart from those threads.`;
  }

  const followUps: string[] = [];
  if (largest) {
    followUps.push(
      `If we took “${largest.label}” seriously, what would the next assignment ask students to do?`,
    );
    followUps.push(`Who gets left out if the room follows “${largest.label}”?`);
  }
  if (tensions[0]) {
    followUps.push(
      `We are pulled between “${tensions[0].leftLabel}” and “${tensions[0].rightLabel}”. What rule could both sides live with?`,
    );
  } else if (themes[1]) {
    followUps.push(
      `What would change if we started from “${themes[1].label}” instead of “${largest?.label ?? "the largest thread"}”?`,
    );
  }

  return {
    overview,
    themes: themes.map(({ id, label, summary, keywords, responseIds }) => ({
      id,
      label,
      summary,
      keywords,
      responseIds,
    })),
    tensions: tensions.slice(0, 2),
    followUps: followUps.slice(0, 3),
    concepts: scaleConcepts(concepts, 28),
    responseCount: items.length,
  };
}

function centroid(indexes: number[], vectors: Map<string, number>[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const index of indexes) {
    for (const [term, weight] of vectors[index]!) {
      totals.set(term, (totals.get(term) ?? 0) + weight);
    }
  }
  for (const [term, weight] of totals) totals.set(term, weight / Math.max(1, indexes.length));
  return totals;
}
