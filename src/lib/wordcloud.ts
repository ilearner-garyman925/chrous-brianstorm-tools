export type CloudWord = {
  text: string;
  weight: number;
  themeId: string | null;
};

export type PlacedWord = CloudWord & {
  x: number;
  y: number;
  fontSize: number;
  w: number;
  h: number;
};

type Measure = (text: string, fontSize: number) => { w: number; h: number };

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  pad: number,
): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function fontFor(
  weight: number,
  minW: number,
  maxW: number,
  width: number,
  height: number,
): number {
  const span = maxW - minW || 1;
  const t = Math.pow(Math.max(0, weight - minW) / span, 0.72);
  const max = Math.max(32, Math.min(width, height) / 6.4);
  return Math.round(15 + t * (max - 15));
}

function placeOne(
  word: CloudWord,
  fontSize: number,
  width: number,
  height: number,
  measure: Measure,
  placed: PlacedWord[],
  steps: number,
): PlacedWord | null {
  let size = fontSize;
  let box = measure(word.text, size);
  while ((box.w > width - 16 || box.h > height - 16) && size > 12) {
    size -= 2;
    box = measure(word.text, size);
  }
  if (box.w > width - 8 || box.h > height - 8) return null;

  const cx = width / 2;
  const cy = height / 2;
  const yScale = Math.max(0.55, Math.min(1, height / Math.max(width, 1)));

  for (let i = 0; i < steps; i += 1) {
    const angle = i * 0.42;
    const radius = angle * 3.15;
    const x = cx + Math.cos(angle) * radius - box.w / 2;
    const y = cy + Math.sin(angle) * radius * yScale - box.h / 2;
    if (x < 6 || y < 6 || x + box.w > width - 6 || y + box.h > height - 6) {
      continue;
    }
    const candidate = { x, y, w: box.w, h: box.h };
    if (placed.some((other) => overlaps(candidate, other, 6))) continue;
    return { ...word, x, y, w: box.w, h: box.h, fontSize: size };
  }
  return null;
}

export function layoutCloud(
  words: CloudWord[],
  width: number,
  height: number,
  measure: Measure,
): PlacedWord[] {
  if (width < 40 || height < 40 || words.length === 0) return [];
  const sorted = [...words].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.text.localeCompare(b.text);
  });
  const weights = sorted.map((word) => word.weight);
  const maxW = Math.max(...weights);
  const minW = Math.min(...weights);
  const placed: PlacedWord[] = [];
  const missed: CloudWord[] = [];

  for (const word of sorted) {
    const fontSize = fontFor(word.weight, minW, maxW, width, height);
    const box = placeOne(word, fontSize, width, height, measure, placed, 720);
    if (box) placed.push(box);
    else missed.push(word);
  }

  for (const word of missed) {
    const fontSize = Math.max(
      12,
      fontFor(word.weight, minW, maxW, width, height) * 0.72,
    );
    const box = placeOne(word, fontSize, width, height, measure, placed, 1100);
    if (box) placed.push(box);
  }

  return placed;
}
