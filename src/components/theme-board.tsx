"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePreferences } from "@/components/preferences";
import { ChorusIcon } from "@/components/chorus-icons";
import { colorForTheme } from "@/lib/colors";
import type { HostResponse, Theme } from "@/lib/types";


export function ThemeBoard({ themes, responses, tone }: {
  overview: string;
  themes: Theme[];
  responses: HostResponse[];
  tone: "paper" | "ink";
}) {
  const { t } = usePreferences();
  const [picked, setPicked] = useState<string | null>(null);
  const panelId = useId();
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const dock = workspace.closest(".orbit-shell")?.querySelector(".orbit-dock");
    const measure = () => {
      const bottom = dock?.getBoundingClientRect().top ?? window.innerHeight;
      workspace.style.setProperty("--themes-height", `${Math.max(180, bottom - workspace.getBoundingClientRect().top - 28)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    if (dock) observer.observe(dock);
    measure();
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [themes.length]);
  const selected = themes.find(theme => theme.id === picked) ?? themes[0];
  const themeIds = themes.map(theme => theme.id);
  const byId = new Map(responses.filter(response => !response.hidden).map(response => [response.id, response]));
  const quotesFor = (theme: Theme) => [...new Set(theme.responseIds)]
    .map(id => byId.get(id)).filter((response): response is HostResponse => Boolean(response))
    .sort((a, b) => a.createdAt - b.createdAt);
  if (!selected) return <p className="themes-empty">{t("Group the room to see the threads.")}</p>;
  return <div className="themes-board" data-tone={tone}>
    <div className="themes-workspace" ref={workspaceRef}>
      <nav className="themes-navigation" aria-label={t("Themes", "主題")}>
        <h2>{t("Themes", "主題")} <span className="themes-badge">{themes.length}</span></h2>
        <div className="themes-themeList">
          {themes.map(theme => <button key={theme.id} type="button" className="themes-themeButton"
            aria-pressed={selected.id === theme.id} aria-controls={panelId} onClick={() => setPicked(theme.id)}>
            <span className="themes-dot" style={{ background: colorForTheme(theme.id, themeIds, tone) }} />
            <span className="themes-label">{theme.label}</span>
            <span className="themes-count">{quotesFor(theme).length} {t(quotesFor(theme).length === 1 ? "response" : "responses", "則回應")}</span>
          </button>)}
        </div>
      </nav>
      <ThemeDetail key={selected.id} theme={selected} quotes={quotesFor(selected)} panelId={panelId}
        color={colorForTheme(selected.id, themeIds, tone)} />
    </div>
  </div>;
}

function ThemeDetail({ theme, quotes, panelId, color }: { theme: Theme; quotes: HostResponse[]; panelId: string; color: string }) {
  const { t } = usePreferences();
  const [originals, setOriginals] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Only identical wording is collapsed; distinct answers and their originals stay intact.
  const groups = new Map<string, HostResponse[]>();
  for (const quote of quotes) {
    const group = groups.get(quote.text) ?? [];
    group.push(quote);
    groups.set(quote.text, group);
  }
  const rows = originals ? quotes.map(quote => [quote]) : [...groups.values()].sort((a, b) => b.length - a.length);
  const visible = showAll ? rows : rows.slice(0, 5);
  return <section id={panelId} className="themes-detail" aria-labelledby={`${panelId}-heading`}>
    <header className="themes-detailHeader">
      <h2 id={`${panelId}-heading`}><span className="themes-dot" style={{ background: color }} />{theme.label}</h2>
      <span className="themes-badge">{quotes.length} {t(quotes.length === 1 ? "response" : "responses", "則回應")}</span>
    </header>
    {theme.summary && <div className="themes-summary"><h3>{t("Theme summary", "主題摘要")}</h3><p>{theme.summary}</p></div>}
    <div className="themes-responseHeader">
      <h3>{t("Student responses", "學生回應")}</h3>
      <div className="themes-modes">
        <button type="button" aria-pressed={!originals} onClick={() => { setOriginals(false); setShowAll(false); }}>{t("Repeated responses grouped", "合併重複回應")}</button>
        <button type="button" aria-pressed={originals} onClick={() => { setOriginals(true); setShowAll(true); }}>{t("View originals", "查看原文")}</button>
      </div>
    </div>
    <ul className="themes-responses">
      {visible.map(group => <li key={group[0].id}>
        {group.length > 1 ? <details className="themes-group">
          <summary><ChorusIcon kind="tensions" /><p>{group[0].text}</p><span className="themes-badge">×{group.length}</span><span className="themes-chevron" aria-hidden="true">⌄</span></summary>
          <ol aria-label={t("Original responses", "原始回應")}>{group.map(quote => <li key={quote.id}>{quote.text}</li>)}</ol>
        </details> : <div className="themes-quote"><ChorusIcon kind="tensions" /><p>{group[0].text}</p></div>}
      </li>)}
    </ul>
    {quotes.length === 0 && <p className="themes-empty">{t("No visible responses in this theme.", "這個主題暫無可顯示的回應。")}</p>}
    <footer className="themes-footer">
      <span>{t("Original wording is preserved.", "保留所有回應原文。")}</span>
      {rows.length > 5 && <button type="button" onClick={() => setShowAll(!showAll)}>{showAll ? t("Show fewer", "收起") : t(`View all ${quotes.length} responses`, `查看全部 ${quotes.length} 則回應`)}</button>}
    </footer>
  </section>;
}
