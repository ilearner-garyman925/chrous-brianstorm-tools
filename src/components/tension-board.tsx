"use client";

import { useState } from "react";
import { colorForTheme } from "@/lib/colors";
import type { HostResponse, Tension, Theme } from "@/lib/types";

function jitter(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return (hash % 100) / 100 - 0.5;
}

export function TensionBoard({
  tensions,
  themes,
  responses,
  tone,
  grouped,
}: {
  tensions: Tension[];
  themes: Theme[];
  responses: HostResponse[];
  tone: "paper" | "ink";
  grouped: boolean;
}) {
  const ink = tone === "ink";
  const byId = new Map(responses.map((response) => [response.id, response]));
  const themeIds = themes.map((theme) => theme.id);
  const themeOf = new Map<string, string>();
  for (const theme of themes) for (const id of theme.responseIds) themeOf.set(id, theme.id);

  if (!grouped) {
    return (
      <p className={`max-w-xl font-serif text-2xl leading-snug ${ink ? "text-[#d7cbb8]" : "text-[#5c5348]"}`}>
        Group the room first. A tension is a disagreement, not just two topics sitting side by side.
      </p>
    );
  }
  if (tensions.length === 0) {
    return (
      <p className={`max-w-xl font-serif text-2xl leading-snug ${ink ? "text-[#d7cbb8]" : "text-[#5c5348]"}`}>
        No split has been named yet. People may still be circling one idea. A follow-up that forces a choice will surface a tension.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {tensions.map((tension) => (
        <TensionTrack
          key={tension.id}
          tension={tension}
          byId={byId}
          themeIds={themeIds}
          themeOf={themeOf}
          tone={tone}
        />
      ))}
    </div>
  );
}

function TensionTrack({
  tension,
  byId,
  themeIds,
  themeOf,
  tone,
}: {
  tension: Tension;
  byId: Map<string, HostResponse>;
  themeIds: string[];
  themeOf: Map<string, string>;
  tone: "paper" | "ink";
}) {
  const ink = tone === "ink";
  const [selected, setSelected] = useState(tension.placements[0]?.responseId ?? "");
  const quote = byId.get(selected);
  return (
    <section>
      <h3 className={`font-serif text-2xl ${ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}`}>{tension.label}</h3>
      <p className={`mt-2 max-w-3xl text-sm leading-relaxed ${ink ? "text-[#e7dccb]" : "text-[#3c342c]"}`}>
        {tension.summary}
      </p>
      <div className="mt-8">
        <div className="flex items-end justify-between gap-4 font-serif text-lg">
          <span className={ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}>{tension.leftLabel}</span>
          <span className={ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}>{tension.rightLabel}</span>
        </div>
        <div
          className={`relative mt-4 h-16 rounded-full ${ink ? "bg-[#2a241e]" : "bg-[#e7dccb]"}`}
        >
          <div className={`absolute top-1/2 right-4 left-4 h-px ${ink ? "bg-[#5c5348]" : "bg-[#cfc3ad]"}`} />
          {tension.placements.map((placement) => {
            const response = byId.get(placement.responseId);
            if (!response) return null;
            const shift = jitter(placement.responseId);
            return (
              <button
                key={placement.responseId}
                type="button"
                className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#faf6ef]"
                style={{
                  left: `${8 + placement.position * 84}%`,
                  marginTop: shift * 18,
                  background: colorForTheme(themeOf.get(placement.responseId) ?? null, themeIds, tone),
                }}
                aria-label={response.text}
                aria-pressed={selected === placement.responseId}
                onClick={() => setSelected(placement.responseId)}
              />
            );
          })}
        </div>
      </div>
      {quote ? (
        <blockquote className={`mt-6 max-w-3xl font-serif text-xl leading-snug ${ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}`}>
          “{quote.text}”
        </blockquote>
      ) : null}
    </section>
  );
}
