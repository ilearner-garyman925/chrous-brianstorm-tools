const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "while",
  "of", "for", "to", "in", "on", "at", "by", "with", "from", "as", "into",
  "over", "after", "before", "out", "up", "down", "about", "than", "that",
  "this", "these", "those", "it", "its", "i", "me", "my", "mine", "we", "our",
  "ours", "you", "your", "yours", "they", "them", "their", "he", "she", "his",
  "her", "is", "am", "are", "was", "were", "be", "been", "being", "do", "does",
  "did", "doing", "done", "have", "has", "had", "having", "will", "would",
  "could", "should", "can", "may", "might", "must", "not", "no", "nor", "so",
  "just", "really", "very", "also", "too", "there", "here", "what", "which",
  "who", "whom", "how", "why", "where", "get", "got", "getting", "make",
  "makes", "made", "want", "wants", "wanted", "think", "thinks", "thought",
  "feel", "feels", "felt", "like", "likes", "something", "anything",
  "everything", "nothing", "someone", "actually", "thing", "things", "way",
  "ways", "because", "each", "other", "another", "such", "only", "own", "same",
  "more", "most", "some", "any", "all", "lot", "lots", "bit", "much", "many",
  "dont", "doesnt", "didnt", "cant", "wont", "im", "ive", "id", "youre",
  "theyre", "thats", "theres", "wasnt", "werent", "isnt", "arent", "hasnt",
  "havent", "hadnt", "wouldnt", "couldnt", "shouldnt", "let", "lets", "via",
  "per", "etc", "yes", "yeah", "okay", "ok", "please", "thanks", "thank",
  "maybe", "perhaps", "still", "already", "even", "ever", "never", "always",
  "around", "across", "through", "without", "within", "upon", "onto", "off",
  "again", "back", "away", "able", "cannot", "gonna", "wanna", "kinda",
  "sort", "right", "now", "today", "tomorrow", "yesterday", "week",
  "using", "used", "use", "uses", "every", "keep", "keeps", "keeping", "kept",
  "show", "say", "said", "says", "people", "need", "needs", "needed", "time",
  "times", "line", "lines", "part", "parts", "give", "gives", "given", "take",
  "takes", "taking", "come", "comes", "came", "look", "tell", "told", "ask",
  "asked", "one", "two", "three", "hard", "step", "rest", "still", "happen",
  "happens", "happening", "happened", "required", "mostly", "longer", "barely",
  "unrelated",
]);

export function expandContractions(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bn't\b/g, " not")
    .replace(/\b'm\b/g, " am")
    .replace(/\b're\b/g, " are")
    .replace(/\b've\b/g, " have")
    .replace(/\b'll\b/g, " will")
    .replace(/\b'd\b/g, " would")
    .replace(/'/g, "");
}

export function stemWord(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith("ies") && word.length > 5) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 6) {
    const base = word.slice(0, -3);
    return base.length >= 4 ? base : word;
  }
  if (word.endsWith("ed") && word.length > 5) {
    let base = word.slice(0, -2);
    if (base.length >= 5 && base.endsWith(base[base.length - 2] ?? "")) {
      base = base.slice(0, -1);
    }
    return base.length >= 4 ? base : word;
  }
  if (/(ches|shes|xes|zes|ses|oes)$/.test(word) && word.length > 5) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) {
    return word.slice(0, -1);
  }
  return word;
}

export type Tokens = {
  stems: string[];
  surfaces: string[];
  bigrams: string[];
  bigramSurfaces: string[];
};

export function tokenize(text: string): Tokens {
  const normalized = expandContractions(text).replace(/[^\p{L}\p{N}\s]/gu, " ");
  const raw = Array.from(new Intl.Segmenter("zh", {granularity:"word"}).segment(normalized))
    .filter(part => part.isWordLike).map(part => part.segment);
  const stems: string[] = [];
  const surfaces: string[] = [];
  for (const token of raw) {
    if (/\p{Script=Han}/u.test(token)) {
      if (!new Set(["我","你","他","她","我們","我们","的","了","是","在","和","也","就","都","覺得","觉得"]).has(token)) {
        stems.push(token); surfaces.push(token);
      }
      continue;
    }
    if (token.length < 3 || STOP.has(token) || /^\d+$/.test(token)) continue;
    const stem = stemWord(token);
    if (stem.length < 3 || STOP.has(stem)) continue;
    stems.push(stem);
    surfaces.push(token);
  }
  const bigrams: string[] = [];
  const bigramSurfaces: string[] = [];
  for (let i = 0; i < stems.length - 1; i += 1) {
    bigrams.push(`${stems[i]} ${stems[i + 1]}`);
    bigramSurfaces.push(`${surfaces[i]} ${surfaces[i + 1]}`);
  }
  return { stems, surfaces, bigrams, bigramSurfaces };
}

export function promptStemSet(prompt: string): Set<string> {
  return new Set(tokenize(prompt).stems);
}

export function prettyPhrase(surface: string): string {
  return surface
    .split(/\s+/)
    .map((part) => part.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean)
    .map((part) => {
      if (part === "ai") return "AI";
      if (STOP.has(part)) return part;
      if (part.length <= 2) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function shortPhrase(text: string): string | null {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.?!]+$/g, "");
  const words = clean.split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 4 || clean.length > 36) return null;
  return prettyPhrase(clean.toLowerCase());
}
