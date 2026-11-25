import { tokenize } from "@/lib/text";

export type ConceptRef = { text: string; themeId: string | null; responseIds?: string[] };

export type ThemeRef = {
  id: string;
  label: string;
  summary: string;
  responseIds: string[];
};

export type ConceptDetail<T extends { id: string; text: string }> = {
  quotes: T[];
  direct: boolean;
  themeLabel: string | null;
  themeSummary: string | null;
};

function mentions(text: string, stems: string[], phrase: string) {
  if (phrase && text.toLowerCase().includes(phrase)) return true;
  if (stems.length === 0) return false;
  const have = new Set(tokenize(text).stems);
  return stems.every((stem) => have.has(stem));
}

export function detailForConcept<T extends { id: string; text: string }>(
  concept: ConceptRef,
  responses: T[],
  themes: ThemeRef[],
): ConceptDetail<T> {
  const theme = concept.themeId ? (themes.find((item) => item.id === concept.themeId) ?? null) : null;
  let pool = theme ? responses.filter((response) => theme.responseIds.includes(response.id)) : responses;
  if (theme && pool.length === 0) pool = responses;
  if (concept.responseIds) {
    const ids = new Set(concept.responseIds);
    return {quotes: responses.filter(response => ids.has(response.id)), direct:true,
      themeLabel:theme?.label ?? null, themeSummary:theme?.summary ?? null};
  }
  const stems = tokenize(concept.text).stems;
  const phrase = concept.text.toLowerCase();
  const directHits = pool.filter((response) => mentions(response.text, stems, phrase));
  return {
    quotes: directHits.length > 0 ? directHits : pool,
    direct: directHits.length > 0,
    themeLabel: theme?.label ?? null,
    themeSummary: theme?.summary ?? null,
  };
}

/** Reverse lookup: prefer explicit membership; never guess from an entire theme fallback. */
export function conceptForResponse<T extends ConceptRef>(response: {id:string;text:string}, concepts:T[], themes:ThemeRef[]):T|null {
  const linked=concepts.find(concept=>concept.responseIds?.includes(response.id));
  if(linked)return linked;
  return concepts.find(concept=>!concept.responseIds && detailForConcept(concept,[response],themes).direct) ?? null;
}
