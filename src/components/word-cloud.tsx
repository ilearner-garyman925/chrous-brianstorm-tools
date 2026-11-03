"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { colorForTheme } from "@/lib/colors";
import type { Concept } from "@/lib/types";
import { layoutCloud, type PlacedWord } from "@/lib/wordcloud";

export function WordCloud({
  concepts,
  themeIds,
  tone,
  legend,
}: {
  concepts: Concept[];
  themeIds: string[];
  tone: "paper" | "ink";
  legend?: { id: string; label: string }[];
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [placed, setPlaced] = useState<PlacedWord[]>([]);
  const signature = useMemo(
    () => concepts.map((concept) => `${concept.text}:${concept.weight}:${concept.themeId}`).join("|"),
    [concepts],
  );

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
        return { w: Math.ceil(context.measureText(text).width) + 2, h: Math.ceil(fontSize * 1.35) };
      });
      setPlaced(boxes);
    };
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
    return () => {
      cancelled = true;
    };
  }, [concepts, signature, size.h, size.w]);

  return (
    <div className="flex h-full min-h-64 flex-col">
      <div ref={frame} className="relative min-h-56 flex-1 overflow-hidden">
        <ul className="sr-only">
          {concepts.map((concept) => (
            <li key={`${concept.text}-${concept.themeId}`}>
              {concept.text}, weight {concept.weight}
            </li>
          ))}
        </ul>
        <div aria-hidden className="absolute inset-0">
          {placed.map((word) => (
            <span
              key={word.text}
              className="absolute font-serif font-semibold leading-none transition-all duration-700"
              style={{
                left: word.x,
                top: word.y,
                fontSize: word.fontSize,
                color: colorForTheme(word.themeId, themeIds, tone),
              }}
            >
              {word.text}
            </span>
          ))}
        </div>
        {concepts.length === 0 ? (
          <p
            className={`absolute inset-0 grid place-items-center px-8 text-center font-serif text-2xl leading-snug ${
              tone === "ink" ? "text-[#d7cbb8]" : "text-[#5c5348]"
            }`}
          >
            Words land here as responses come in.
          </p>
        ) : null}
      </div>
      {legend && legend.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {legend.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ background: colorForTheme(item.id, themeIds, tone) }}
              />
              <span className={tone === "ink" ? "text-[#f3ecdf]" : "text-[#1e1a16]"}>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
