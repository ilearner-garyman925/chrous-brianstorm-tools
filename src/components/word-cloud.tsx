"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { colorForTheme } from "@/lib/colors";
import { detailForConcept, type ThemeRef } from "@/lib/concept-detail";
import type { Concept } from "@/lib/types";
import { layoutCloud, type PlacedWord } from "@/lib/wordcloud";
import { OrbitCloud } from "@/components/orbit-cloud";

export type CloudQuote = { id: string; text: string; label?: string; participantId?: string };

function hash(text: string) {
  let value = 0;
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value;
}

export function WordCloud(props: Parameters<typeof ClassicWordCloud>[0] & { orbit?: boolean; focusRequest?: {key:string;sequence:number}|null; onFocusHandled?:()=>void; onHide?: (id: string) => void; busy?: boolean; animationHistory?: Set<string>; animationScope?: string }) {
  return props.orbit ? <OrbitCloud {...props} /> : <ClassicWordCloud {...props} />;
}

function ClassicWordCloud({
  concepts,
  themeIds,
  tone,
  legend,
  playful = false,
  quotes = [],
  themes = [],
  showNames = false,
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
  showNames?: boolean;
  pickedKey?: string | null;
  onPick?: (key: string | null) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [placed, setPlaced] = useState<PlacedWord[]>([]);
  const [localPick, setLocalPick] = useState<string | null>(null);
  const activeKey = onPick ? pickedKey : localPick;
  const choose = (key: string | null) => {
    if (onPick) onPick(key);
    else setLocalPick(key);
  };
  const signature = JSON.stringify(concepts);
  const layoutConcepts = useMemo(() => JSON.parse(signature) as Concept[], [signature]);
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
        getComputedStyle(document.documentElement).getPropertyValue("--font-outfit").trim() ||
        "sans-serif";
      const maxWidth = size.w < 480 ? size.w - 32 : Math.min(320, size.w * .4);
      const measure = (text: string, fontSize: number) => {
        context.font = `600 ${fontSize}px ${family}`;
        const padX = playful ? Math.max(12, Math.round(fontSize * .45)) : 2;
        const padY = playful ? Math.max(8, Math.round(fontSize * .3)) : 2;
        const available = Math.max(12, maxWidth - padX * 2);
        // Measure wrapping by grapheme-sized code points; CSS can break long tokens too.
        let line = "";
        let lines = 1;
        let widest = 0;
        for (const char of Array.from(text)) {
          if (line && context.measureText(line + char).width > available) {
            widest = Math.max(widest, context.measureText(line).width);
            line = char;
            lines++;
          } else line += char;
        }
        widest = Math.max(widest, context.measureText(line).width);
        return {w: Math.min(maxWidth, Math.ceil(widest) + padX * 2),
          h: Math.ceil(fontSize * 1.25 * lines) + padY * 2};
      };
      let height = size.w < 480 ? Math.max(size.h, layoutConcepts.length * 56) : size.h;
      let boxes = layoutCloud(layoutConcepts, size.w, height, measure);
      // Grow the scrollable canvas instead of dropping concepts or shrinking unreadably.
      for (let attempt = 0; boxes.length < layoutConcepts.length && attempt < 12; attempt++) {
        height += 160;
        boxes = layoutCloud(layoutConcepts, size.w, height, measure);
      }
      setLayoutHeight(height);
      setPlaced(boxes);
    };
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
    return () => {
      cancelled = true;
    };
  }, [layoutConcepts, playful, size.h, size.w]);

  const picked = playful ? placed.find((word) => wordKey(word) === activeKey) : undefined;
  const detail = picked ? detailForConcept(picked, quotes, themes) : null;
  const shown = detail?.quotes.slice(0, 6) ?? [];
  const extra = detail ? detail.quotes.length - shown.length : 0;

  return (
    <div className="relative flex h-full min-h-64 flex-col">
      {playful ? (
        <style>{`
          @keyframes chorus-drift {
            0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--tilt, 0deg)) scale(1); }
            50% { transform: translate3d(var(--dx, 14px), var(--dy, -18px), 0) rotate(calc(var(--tilt, 0deg) * -1)) scale(1); }
          }
          .chorus-bubble { animation: chorus-drift var(--dur, 4s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
          @media (prefers-reduced-motion: reduce) { .chorus-bubble { animation: none; } }
        `}</style>
      ) : null}
      <div ref={frame} className="relative min-h-56 flex-1 overflow-auto">
        {playful ? null : (
          <ul className="sr-only">
            {concepts.map((concept) => (
              <li key={`${concept.text}-${concept.themeId}`}>
                {concept.text}, weight {concept.weight}
              </li>
            ))}
          </ul>
        )}
        <div className="relative w-full" style={{height: layoutHeight || "100%"}} aria-hidden={playful ? undefined : true}>
          {placed.map((word) => {
            const key = wordKey(word);
            const color = colorForTheme(word.themeId, themeIds, tone);
            const n = hash(word.text);
            const selected = key === activeKey;
            const motion = {
              "--dx": `${(n % 5) - 2}px`,
              "--dy": `${-2 - (n % 3)}px`,
              "--tilt": `0deg`,
              "--dur": `${3.2 + (n % 20) / 10}s`,
              "--delay": `${-((n % 32) / 10)}s`,
            } as CSSProperties;
            if (!playful) {
              return (
                <span
                  key={key}
                  className="absolute font-sans font-semibold leading-none transition-all duration-700"
                  style={{
                    left: word.x,
                    top: word.y,
                    width: word.w,
                    height: word.h,
                    overflowWrap: "anywhere",
                    wordBreak: "break-all",
                    lineHeight: 1.25,
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
                className={`chorus-bubble absolute grid cursor-pointer place-items-center px-2 text-center font-sans font-semibold leading-none transition-shadow ${
                  selected ? "z-30" : "z-10 hover:z-20"
                }`}
                style={{
                  ...motion,
                  left: word.x,
                  top: word.y,
                  width: word.w,
                  height: word.h,
                  padding: `${Math.max(4, Math.round(word.fontSize * .3) - 4)}px ${Math.max(8, Math.round(word.fontSize * .45) - 4)}px`,
                  overflowWrap: "anywhere",
                  wordBreak: "break-all",
                  lineHeight: 1.25,
                  fontSize: word.fontSize,
                  color: ink ? color : "#182044",
                  background: `color-mix(in srgb, ${color} ${selected ? 42 : 28}%, ${ink ? "#211c17" : "#ffffff"})`,
                  border: `2px solid color-mix(in srgb, ${color} ${selected ? 90 : 70}%, transparent)`,
                  borderRadius: "50%",
                  boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${color} 35%, transparent)` : undefined,
                  animationPlayState: selected ? "paused" : "running",
                }}
                aria-pressed={selected}
                onClick={() => choose(selected ? null : key)}
              >
                {word.text}
              </button>
            );
          })}
        </div>
        {concepts.length === 0 ? (
          <p
            className={`absolute inset-0 grid place-items-center px-8 text-center font-sans text-2xl leading-snug ${
              ink ? "text-[#d7cbb8]" : "text-[#586380]"
            }`}
          >
            Words land here as responses come in.
          </p>
        ) : null}
      </div>
      {picked && detail ? (
        <aside
          className={`absolute inset-x-0 bottom-0 z-20 max-h-[46%] overflow-auto rounded-[1.6rem] border p-5 shadow-2xl ${
            ink ? "border-[#3a332b] bg-[#211c17] text-[#f5f7fc]" : "border-[#dbe1ef] bg-[#ffffff] text-[#182044]"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-xs tracking-[0.16em] uppercase ${ink ? "text-[#d7cbb8]" : "text-[#5138ed]"}`}>
                {detail.themeLabel ?? "Across the room"}
              </p>
              <h3 className="mt-1 font-sans text-3xl leading-none">{picked.text}</h3>
              <p className={`mt-2 text-sm leading-relaxed ${ink ? "text-[#edf0fa]" : "text-[#586380]"}`}>
                {detail.direct
                  ? `${detail.quotes.length} ${detail.quotes.length === 1 ? "line uses" : "lines use"} this.`
                  : detail.themeSummary || "These lines sit in the same thread."}
              </p>
            </div>
            <button
              type="button"
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${ink ? "bg-white/10" : "bg-[#edf0fa]"}`}
              onClick={() => choose(null)}
            >
              Close
            </button>
          </div>
          {shown.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {shown.map((quote) => (
                <li key={quote.id} className="font-sans text-lg leading-snug">
                  {showNames && quote.label ? (
                    <span className={`mb-1 block font-sans text-xs ${ink ? "text-[#d7cbb8]" : "text-[#586380]"}`}>
                      {quote.label}
                    </span>
                  ) : null}
                  “{quote.text}”
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-4 text-sm ${ink ? "text-[#d7cbb8]" : "text-[#586380]"}`}>
              Group the room to attach this word to the lines that used it.
            </p>
          )}
          {extra > 0 ? (
            <p className={`mt-3 text-sm ${ink ? "text-[#d7cbb8]" : "text-[#586380]"}`}>
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
              <span className={ink ? "text-[#f5f7fc]" : "text-[#182044]"}>{item.label}</span>
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
