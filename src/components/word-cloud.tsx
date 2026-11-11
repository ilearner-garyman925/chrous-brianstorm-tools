"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { colorForTheme } from "@/lib/colors";
import { detailForConcept, type ThemeRef } from "@/lib/concept-detail";
import type { Concept } from "@/lib/types";
import { layoutCloud, type PlacedWord } from "@/lib/wordcloud";

export type CloudQuote = { id: string; text: string };

function hash(text: string) {
  let value = 0;
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value;
}

function blobRadius(text: string) {
  const n = hash(text);
  const a = 46 + (n % 22);
  const b = 38 + ((n >> 3) % 26);
  const c = 48 + ((n >> 6) % 20);
  const d = 36 + ((n >> 9) % 24);
  return `${a}% ${100 - b}% ${c}% ${100 - d}% / ${b}% ${d}% ${100 - c}% ${a}%`;
}

export function WordCloud({
  concepts,
  themeIds,
  tone,
  legend,
  playful = false,
  quotes = [],
  themes = [],
  pickedKey = null,
  onPick,
}: {
  concepts: Concept[];
  themeIds: string[];
  tone: "paper" | "ink";
  legend?: { id: string; label: string }[];
  playful?: boolean;
  quotes?: CloudQuote[];
  themes?: ThemeRef[];
  pickedKey?: string | null;
  onPick?: (key: string | null) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [placed, setPlaced] = useState<PlacedWord[]>([]);
  const signature = useMemo(
    () => concepts.map((concept) => `${concept.text}:${concept.weight}:${concept.themeId}`).join("|"),
    [concepts],
  );
  const ink = tone === "ink";

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.w < 40 || size.h < 40) return;
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const family =
        getComputedStyle(document.documentElement).getPropertyValue("--font-fraunces").trim() ||
        "Georgia";
      const boxes = layoutCloud(concepts, size.w, size.h, (text, fontSize) => {
        context.font = `600 ${fontSize}px ${family}`;
        const padX = playful ? Math.round(fontSize * 0.72) : 1;
        const padY = playful ? Math.round(fontSize * 0.48) : 0;
        return {
          w: Math.ceil(context.measureText(text).width) + padX * 2,
          h: Math.ceil(fontSize * 1.2) + padY * 2,
        };
      });
      setPlaced(boxes);
    };
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
    return () => {
      cancelled = true;
    };
  }, [concepts, playful, signature, size.h, size.w]);

  const picked = playful ? placed.find((word) => wordKey(word) === pickedKey) : undefined;
  const detail = picked ? detailForConcept(picked, quotes, themes) : null;
  const shown = detail?.quotes.slice(0, 6) ?? [];
  const extra = detail ? detail.quotes.length - shown.length : 0;

  return (
    <div className="relative flex h-full min-h-64 flex-col">
      <div ref={frame} className="relative min-h-56 flex-1 overflow-hidden">
        {playful ? null : (
          <ul className="sr-only">
            {concepts.map((concept) => (
              <li key={`${concept.text}-${concept.themeId}`}>
                {concept.text}, weight {concept.weight}
              </li>
            ))}
          </ul>
        )}
        <div className="absolute inset-0" aria-hidden={playful ? undefined : true}>
          {placed.map((word) => {
            const key = wordKey(word);
            const color = colorForTheme(word.themeId, themeIds, tone);
            const n = hash(word.text);
            const selected = key === pickedKey;
            const motion = {
              "--dx": `${(n % 13) - 6}px`,
              "--dy": `${-4 - (n % 8)}px`,
              "--tilt": `${(n % 5) - 2}deg`,
              "--dur": `${6 + (n % 35) / 10}s`,
              "--delay": `${-((n % 50) / 10)}s`,
            } as CSSProperties;
            if (!playful) {
              return (
                <span
                  key={key}
                  className="absolute font-serif font-semibold leading-none transition-all duration-700"
                  style={{
                    left: word.x,
                    top: word.y,
                    fontSize: word.fontSize,
                    color,
                  }}
                >
                  {word.text}
                </span>
              );
            }
            return (
              <button
                key={key}
                type="button"
                className={`chorus-bubble absolute grid cursor-pointer place-items-center px-2 text-center font-serif font-semibold leading-none transition-shadow ${
                  selected ? "z-30" : "z-10 hover:z-20"
                }`}
                style={{
                  ...motion,
                  left: word.x,
                  top: word.y,
                  width: word.w,
                  height: word.h,
                  fontSize: word.fontSize,
                  color,
                  background: `color-mix(in srgb, ${color} ${selected ? 34 : 18}%, transparent)`,
                  border: `1.5px solid color-mix(in srgb, ${color} ${selected ? 80 : 48}%, transparent)`,
                  borderRadius: blobRadius(word.text),
                  boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${color} 35%, transparent)` : undefined,
                  animationPlayState: selected ? "paused" : "running",
                }}
                aria-pressed={selected}
                onClick={() => onPick?.(selected ? null : key)}
              >
                {word.text}
              </button>
            );
          })}
        </div>
        {concepts.length === 0 ? (
          <p
            className={`absolute inset-0 grid place-items-center px-8 text-center font-serif text-2xl leading-snug ${
              ink ? "text-[#d7cbb8]" : "text-[#5c5348]"
            }`}
          >
            Words land here as responses come in.
          </p>
        ) : null}
      </div>
      {picked && detail ? (
        <aside
          className={`absolute inset-x-0 bottom-0 z-20 max-h-[46%] overflow-auto rounded-[1.6rem] border p-5 shadow-2xl ${
            ink ? "border-[#3a332b] bg-[#211c17] text-[#f3ecdf]" : "border-[#d9cdb8] bg-[#faf6ef] text-[#1e1a16]"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-xs tracking-[0.16em] uppercase ${ink ? "text-[#d7cbb8]" : "text-[#b8612d]"}`}>
                {detail.themeLabel ?? "Across the room"}
              </p>
              <h3 className="mt-1 font-serif text-3xl leading-none">{picked.text}</h3>
              <p className={`mt-2 text-sm leading-relaxed ${ink ? "text-[#e7dccb]" : "text-[#5c5348]"}`}>
                {detail.direct
                  ? `${detail.quotes.length} ${detail.quotes.length === 1 ? "line uses" : "lines use"} this.`
                  : detail.themeSummary || "These lines sit in the same thread."}
              </p>
            </div>
            <button
              type="button"
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${ink ? "bg-white/10" : "bg-[#e7dccb]"}`}
              onClick={() => onPick?.(null)}
            >
              Close
            </button>
          </div>
          {shown.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {shown.map((quote) => (
                <li key={quote.id} className="font-serif text-lg leading-snug">
                  “{quote.text}”
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-4 text-sm ${ink ? "text-[#d7cbb8]" : "text-[#5c5348]"}`}>
              Group the room to attach this word to the lines that used it.
            </p>
          )}
          {extra > 0 ? (
            <p className={`mt-3 text-sm ${ink ? "text-[#d7cbb8]" : "text-[#5c5348]"}`}>
              Plus {extra} more in this thread. The desk has every line.
            </p>
          ) : null}
        </aside>
      ) : null}
      {legend && legend.length > 0 && !picked ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {legend.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-full" style={{ background: colorForTheme(item.id, themeIds, tone) }} />
              <span className={ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function wordKey(word: PlacedWord) {
  return `${word.text}:${word.themeId ?? ""}`;
}
