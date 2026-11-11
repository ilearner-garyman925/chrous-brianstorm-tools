import { tokenize } from "@/lib/text";

export type ConceptRef = { text: string; themeId: string | null };

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
