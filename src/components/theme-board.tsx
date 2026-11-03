"use client";

import { useState } from "react";
import { colorForTheme } from "@/lib/colors";
import type { HostResponse, Theme } from "@/lib/types";

export function ThemeBoard({
  overview,
  themes,
  responses,
  tone,
}: {
  overview: string;
  themes: Theme[];
  responses: HostResponse[];
  tone: "paper" | "ink";
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const openId =
    picked !== null && (picked === "" || themes.some((theme) => theme.id === picked))
      ? picked
      : (themes[0]?.id ?? "");
  const themeIds = themes.map((theme) => theme.id);
  const byId = new Map(responses.map((response) => [response.id, response]));
  const ink = tone === "ink";

  if (themes.length === 0) {
    return (
      <p className={`font-serif text-2xl ${ink ? "text-[#d7cbb8]" : "text-[#5c5348]"}`}>
        Group the room to see the threads.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className={`max-w-3xl font-serif text-2xl leading-snug ${ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}`}>
        {overview}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {themes.map((theme) => {
          const quotes = theme.responseIds
            .map((id) => byId.get(id))
            .filter((response): response is HostResponse => Boolean(response))
            .sort((a, b) => a.createdAt - b.createdAt);
          const open = theme.id === openId;
          return (
            <article
              key={theme.id}
              className={`rounded-2xl border p-4 ${
                ink ? "border-[#3a332b] bg-[#211c17]" : "border-[#d9cdb8] bg-[#faf6ef]"
              } ${open ? "md:col-span-2" : ""}`}
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 text-left"
                onClick={() => setPicked(open ? "" : theme.id)}
                aria-expanded={open}
              >
                <span
                  className="mt-1.5 size-3 shrink-0 rounded-full"
                  style={{ background: colorForTheme(theme.id, themeIds, tone) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className={`font-serif text-2xl ${ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}`}>
                      {theme.label}
                    </span>
                    <span className={ink ? "text-[#d7cbb8]" : "text-[#5c5348]"}>
                      {quotes.length} {quotes.length === 1 ? "voice" : "voices"}
                    </span>
                  </span>
                  <span className={`mt-2 block text-sm leading-relaxed ${ink ? "text-[#e7dccb]" : "text-[#3c342c]"}`}>
                    {theme.summary}
                  </span>
                </span>
              </button>
              {open ? (
                <ul className="mt-4 space-y-3 border-t border-current/10 pt-4">
                  {quotes.map((quote) => (
                    <li key={quote.id} className={`font-serif text-lg leading-snug ${ink ? "text-[#f3ecdf]" : "text-[#1e1a16]"}`}>
                      “{quote.text}”
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
