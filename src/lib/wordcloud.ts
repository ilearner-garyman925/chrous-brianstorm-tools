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

function intersects(a: PlacedWord, b: PlacedWord, gap: number) {
  return !(a.x+a.w+gap<=b.x || b.x+b.w+gap<=a.x || a.y+a.h+gap<=b.y || b.y+b.h+gap<=a.y);
}

/** Seeded best-candidate packing: use the entire canvas, never a row or spiral. */
export function layoutCloud(words: CloudWord[], width: number, height: number, measure: Measure, constellation = false): PlacedWord[] {
  if (width < 40 || height < 40 || !words.length) return [];
  const sorted = [...words].sort((a,b)=>b.weight-a.weight || a.text.localeCompare(b.text));
  const min = Math.min(...sorted.map(w=>w.weight));
  const max = Math.max(...sorted.map(w=>w.weight));
  let best: PlacedWord[] = [];
  const mobile = width < 480;
  const groups = [...new Set(sorted.map(word => word.themeId))];
  // Retry at progressively smaller sizes before asking the UI for more height.
  for (let attempt=0; attempt<(constellation ? 14 : 9); attempt++) {
    let seed = 7919;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const placed: PlacedWord[] = [];
    const gap = mobile ? 14 : Math.max(10, 22-attempt*2);
    for (const word of sorted) {
      const importance = max===min ? .5 : (word.weight-min)/(max-min);
      const fontSize = Math.max(mobile ? 18 : 16, Math.round((mobile ? 22+importance*12 : 24+importance*24)*(1-attempt*.065)));
      const box = measure(word.text,fontSize);
      if (box.w>width-20 || box.h>height-20) continue;
      let chosen: PlacedWord | null = null;
      let score = -Infinity;
      for (let i=0;i<1400;i++) {
        const candidate = {...word,...box,fontSize,x:10+random()*(width-box.w-20),y:10+random()*(height-box.h-20)};
        if (placed.some(other=>intersects(candidate,other,gap))) continue;
        const cx=candidate.x+box.w/2, cy=candidate.y+box.h/2;
        // Farthest-point placement spreads later concepts into unused regions.
        const distance = placed.length ? Math.min(...placed.map(other=>Math.hypot((cx-other.x-other.w/2)/width,(cy-other.y-other.h/2)/height))) : -Math.hypot(cx/width-.38,cy/height-.35);
        const groupIndex = groups.indexOf(word.themeId);
        const angle = groupIndex * 2.39996;
        const anchorX = mobile ? .5 + Math.sin(angle) * .2 : .5 + Math.cos(angle) * .32;
        const anchorY = mobile ? (groupIndex + .5) / groups.length : .5 + Math.sin(angle) * .32;
        const groupDistance = Math.hypot(cx / width - anchorX, cy / height - anchorY);
        const candidateScore = constellation ? distance * .2 - groupDistance : distance;
        if (candidateScore>score) {score=candidateScore;chosen=candidate;}
      }
      if (chosen) placed.push(chosen);
    }
    if (placed.length>best.length) best=placed;
    if (placed.length===words.length) return placed;
  }
  return best;
}
